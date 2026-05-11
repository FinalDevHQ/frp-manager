# frp-manager

可视化管理 frpc.yml 的轻量 Web 工具。

## 功能
- proxy 增删改查、YAML 预览与 diff
- 部署 Profile：配置 frpc.yml 路径 + reload 策略
- Reload 策略：`admin-api` / `systemctl` / `docker` / `docker-compose` / `command` / `none`
- 自动发现：扫描常见 frpc.yml 路径、systemd 服务、docker 容器、docker-compose 文件
- frpc webServer 一键启用

## 本地开发
```bash
npm install
npm run dev:server   # http://localhost:3000
npm run dev:web      # http://localhost:5500（vite 已代理 /api → 3000）
```

## Docker 部署（推荐生产用法）

仓库根目录已带 `Dockerfile` 和 `docker-compose.yml`，多阶段构建产出单镜像：内置 Node 运行时 + 静态前端 + `docker` CLI（含 compose 插件）。

### 一键启动
```bash
# 在服务器上 clone/拉取仓库后
docker compose up -d --build
```
访问 `http://<host>:3000`，首屏会跳到 **Setup** 页：
1. 填写 frpc.yml 路径（**容器内**路径，例如 `/etc/frp/frpc.yml`）
2. 选 reload 策略（容器场景推荐 `admin-api` 或 `docker-compose`）
3. 测试 → 保存

### `docker-compose.yml` 关键 volumes
| 宿主路径 | 容器路径 | 用途 |
| --- | --- | --- |
| `./runtime` | `/app/runtime` | 持久化 `profile.json`，必须 |
| `/etc/frp/frpc.yml` | `/etc/frp/frpc.yml` | 让容器能读写宿主 frpc.yml，**路径要保持一致** |
| `/var/run/docker.sock` | `/var/run/docker.sock` | 让容器内 `docker` / `docker compose` 操作宿主上的 frpc 容器 |

### Reload 策略与容器的搭配
- **admin-api**：最干净。frpc 启用 `webServer` 后，容器通过网络调用，无须挂 socket。`baseUrl` 用宿主 IP（或 `host.docker.internal`，加 `extra_hosts: ["host.docker.internal:host-gateway"]`）。
- **docker / docker-compose**：必须挂 `/var/run/docker.sock`；`docker-compose` 策略还要把宿主的 `docker-compose.yml` 挂到容器内**相同路径**。
- **systemctl**：不推荐在容器内使用。
- **command**：执行的是**容器内**的 shell 命令，慎用。

### 环境变量启动锁定（可选）
若想跳过 Setup 页直接锁死配置：
```yaml
environment:
  FRPC_CONFIG_PATH: /etc/frp/frpc.yml
  FRPC_RELOAD_TYPE: admin-api
  FRPC_ADMIN_BASE_URL: http://host.docker.internal:7400
```
完整变量列表见 `packages/config-core/src/profile.service.ts`。

### 健康检查
镜像内置 `HEALTHCHECK`，调用 `/api/health`。`docker ps` 会显示 `(healthy)`。

### 升级
```bash
git pull
docker compose up -d --build
```
`runtime/profile.json` 由 volume 持久化，升级不会丢配置。

### 国内服务器构建加速
构建会拉三类资源，国内访问任一都可能超时：

| 资源 | 默认源 | 国内替代 |
| --- | --- | --- |
| 基础镜像 `node:20-alpine` | `docker.io` | `docker.m.daocloud.io/library/node:20-alpine` |
| apk 系统包 | `dl-cdn.alpinelinux.org` | `https://mirrors.tuna.tsinghua.edu.cn/alpine` |
| npm 包 | `registry.npmjs.org` | `https://registry.npmmirror.com` |

Dockerfile 已支持 `--build-arg` 一键切换。**任选一种**：

**方式 A：改 `docker-compose.yml`**（推荐，一次配好）
取消 `build.args` 块的注释即可，然后照常 `docker compose up -d --build`。

**方式 B：命令行 build-arg**
```bash
docker compose build \
  --build-arg NODE_IMAGE=docker.m.daocloud.io/library/node:20-alpine \
  --build-arg APK_MIRROR=https://mirrors.tuna.tsinghua.edu.cn/alpine \
  --build-arg NPM_REGISTRY=https://registry.npmmirror.com
docker compose up -d
```

**方式 C：daemon 全局 registry-mirror**（影响所有项目）
`/etc/docker/daemon.json`：
```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://dockerproxy.com"
  ]
}
```
`systemctl restart docker`，然后 `docker compose up -d --build`。

> 个别 VPS 的 IPv6 路由到 `*.docker.io` 不通但 IPv4 正常，可在 `/etc/docker/daemon.json` 里加 `"ipv6": false` 后重启 docker。
