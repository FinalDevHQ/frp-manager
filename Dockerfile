# ───────────────────────────────────────────────────────────────
# Stage 1: 安装依赖（包含 dev，为构建 web 服务）
# ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

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
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    FRP_MANAGER_PROFILE_PATH=/app/runtime/profile.json \
    WEB_DIST_DIR=/app/apps/web/dist

# docker CLI（含 compose 插件）+ tini 作为 PID 1
RUN apk add --no-cache docker-cli docker-cli-compose tini curl

# 仅装运行时需要的 npm 包（tsx 已是 server 的 dependency）
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
