# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# frp-manager 镜像
#
# 多阶段构建：
#   1) deps      —— 安装包含 devDependencies 的依赖（构建 web 需要）
#   2) build-web —— 编译前端静态产物到 /app/apps/web/dist
#   3) runtime   —— 生产镜像：Node + 静态前端 + docker CLI(+ compose)
#
# 网络可调参数（默认值已针对中国大陆网络优化，海外构建覆盖为空串即可）：
#   --build-arg NODE_IMAGE=node:20-alpine
#   --build-arg APK_MIRROR=
#   --build-arg NPM_REGISTRY=
#
# 国内备选镜像源（任选一组，遇到不通就换下一个）：
#   NODE_IMAGE:
#     docker.m.daocloud.io/library/node:20-alpine   (DaoCloud)
#     docker.1ms.run/library/node:20-alpine         (1ms)
#     dockerproxy.cn/library/node:20-alpine         (dockerproxy)
#   APK_MIRROR:
#     https://mirrors.tuna.tsinghua.edu.cn/alpine   (清华)
#     https://mirrors.ustc.edu.cn/alpine            (中科大)
#     https://mirrors.aliyun.com/alpine             (阿里云)
#   NPM_REGISTRY:
#     https://registry.npmmirror.com                (淘宝)
# ─────────────────────────────────────────────────────────────────────────────
ARG NODE_IMAGE=docker.m.daocloud.io/library/node:20-alpine

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: deps — 安装所有依赖（含 dev）
# ─────────────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app

ARG APK_MIRROR=https://mirrors.tuna.tsinghua.edu.cn/alpine
ARG NPM_REGISTRY=https://registry.npmmirror.com

# 切换 alpine 源（如果传了 APK_MIRROR）。匹配任意 dl-cdn 主机名的行
RUN set -eux; \
    if [ -n "$APK_MIRROR" ]; then \
      sed -i "s|https\?://dl-cdn\.alpinelinux\.org/alpine|${APK_MIRROR}|g" /etc/apk/repositories; \
    fi; \
    cat /etc/apk/repositories

# 配置 npm：切源 + 增加重试/超时（国内丢包场景非常关键）
RUN set -eux; \
    if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi; \
    npm config set fetch-retries 5; \
    npm config set fetch-retry-mintimeout 20000; \
    npm config set fetch-retry-maxtimeout 180000; \
    npm config set fetch-timeout 600000; \
    npm config get registry

# 先只复制 manifest，最大化利用 Docker layer 缓存
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json    apps/web/package.json
COPY packages/shared/package.json      packages/shared/package.json
COPY packages/config-core/package.json packages/config-core/package.json

# 安装依赖（含 dev，因为下一阶段要跑 vite/tsc）。
# 故意使用 npm install 而非 npm ci：lockfile 在 Windows/macOS 生成时不会包含
# linux-musl 的原生 binding（如 @rolldown/binding-linux-x64-musl），npm ci 会硬失败。
# BuildKit cache mount 让重复构建走本地 npm 缓存，国内拉包速度提升明显。
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm install --include=dev --no-audit --no-fund

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: build-web — 编译前端静态产物
# ─────────────────────────────────────────────────────────────────────────────
FROM deps AS build-web
WORKDIR /app
COPY apps/web apps/web
COPY packages packages
RUN npm run build --workspace web

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: runtime — 生产镜像
#   * tsx 跑 server 源码，避免单独打包 server
#   * apk 装 docker-cli + docker-cli-compose + tini + curl
# ─────────────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app

ARG APK_MIRROR=https://mirrors.tuna.tsinghua.edu.cn/alpine
ARG NPM_REGISTRY=https://registry.npmmirror.com

ENV NODE_ENV=production \
    PORT=3000 \
    FRP_MANAGER_PROFILE_PATH=/app/runtime/profile.json \
    WEB_DIST_DIR=/app/apps/web/dist

# alpine 换源 + 装系统包（tini 进程托管 / docker CLI / curl 健康检查）
RUN set -eux; \
    if [ -n "$APK_MIRROR" ]; then \
      sed -i "s|https\?://dl-cdn\.alpinelinux\.org/alpine|${APK_MIRROR}|g" /etc/apk/repositories; \
    fi; \
    apk update; \
    apk add --no-cache docker-cli docker-cli-compose tini curl ca-certificates tzdata

# npm 换源 + 重试参数（同 deps）
RUN set -eux; \
    if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi; \
    npm config set fetch-retries 5; \
    npm config set fetch-retry-mintimeout 20000; \
    npm config set fetch-retry-maxtimeout 180000; \
    npm config set fetch-timeout 600000

# 仅安装运行时依赖（tsx 在 server 的 dependencies 里）
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json    apps/web/package.json
COPY packages/shared/package.json      packages/shared/package.json
COPY packages/config-core/package.json packages/config-core/package.json

RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm install --omit=dev --no-audit --no-fund

# 复制 server 源码、共享包以及前端构建产物
COPY apps/server apps/server
COPY packages   packages
COPY --from=build-web /app/apps/web/dist /app/apps/web/dist

# 运行时挂载点（profile.json 会持久化到这里）
RUN mkdir -p /app/runtime
VOLUME ["/app/runtime"]

EXPOSE 3000

# 健康检查：/api/health 必须 200
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npx", "--no-install", "tsx", "apps/server/src/index.ts"]
