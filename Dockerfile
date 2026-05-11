# ───────────────────────────────────────────────────────────────
# 可调镜像源（默认走上游；国内构建可用 --build-arg 切换）
#
# 国内推荐：
#   --build-arg NODE_IMAGE=docker.m.daocloud.io/library/node:20-alpine \
#   --build-arg APK_MIRROR=https://mirrors.tuna.tsinghua.edu.cn/alpine \
#   --build-arg NPM_REGISTRY=https://registry.npmmirror.com
# ───────────────────────────────────────────────────────────────
ARG NODE_IMAGE=node:20-alpine

# ───────────────────────────────────────────────────────────────
# Stage 1: 安装依赖（包含 dev，为构建 web 服务）
# ───────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ARG APK_MIRROR=
ARG NPM_REGISTRY=

# 可选：切换 alpine 源（此阶段暂不需要 apk，但 base 镜像里 npm 自身偶尔会触发；保险起见）
RUN if [ -n "$APK_MIRROR" ]; then \
      sed -i "s|https\\?://dl-cdn.alpinelinux.org|${APK_MIRROR}|g" /etc/apk/repositories; \
    fi
# 可选：切换 npm registry
RUN if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi

# 先只复制 manifest 以利用 Docker 构建缓存
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config-core/package.json packages/config-core/package.json

# 用 npm ci，包含 devDependencies（vite/tsc 需要）
RUN npm ci --include=dev

# ───────────────────────────────────────────────────────────────
# Stage 2: 构建 web 静态产物
# ───────────────────────────────────────────────────────────────
FROM deps AS build-web
WORKDIR /app
COPY apps/web apps/web
COPY packages packages
RUN npm run build --workspace web

# ───────────────────────────────────────────────────────────────
# Stage 3: 生产镜像
#  - 用 tsx 运行 server，源码模式，避免单独打包 server
#  - 安装 docker CLI（含 compose 子命令），支持 docker / docker-compose 策略
# ───────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ARG APK_MIRROR=
ARG NPM_REGISTRY=
ENV NODE_ENV=production \
    PORT=3000 \
    FRP_MANAGER_PROFILE_PATH=/app/runtime/profile.json \
    WEB_DIST_DIR=/app/apps/web/dist

# 切换 alpine 源（如有），再装系统依赖
RUN if [ -n "$APK_MIRROR" ]; then \
      sed -i "s|https\\?://dl-cdn.alpinelinux.org|${APK_MIRROR}|g" /etc/apk/repositories; \
    fi \
 && apk add --no-cache docker-cli docker-cli-compose tini curl

# 切换 npm registry（如有），仅装运行时 npm 包（tsx 已是 server 的 dependency）
RUN if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config-core/package.json packages/config-core/package.json
RUN npm ci --omit=dev && npm cache clean --force

# 复制源码 + 构建产物
COPY apps/server apps/server
COPY packages packages
COPY --from=build-web /app/apps/web/dist /app/apps/web/dist

# 运行时挂载点
RUN mkdir -p /app/runtime
VOLUME ["/app/runtime"]

EXPOSE 3000

# 健康检查：/api/health 必须 200
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npx", "--no-install", "tsx", "apps/server/src/index.ts"]
