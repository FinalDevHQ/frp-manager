# frp-manager

可视化管理 frpc 配置的轻量 Web 工具。

## 功能
- proxy 增删改查、配置预览与 diff
- **YAML / TOML 双格式**（按文件后缀自动识别）
- 部署 Profile：配置文件路径 + reload 策略
- Reload 策略：`admin-api` / `systemctl` / `docker` / `docker-compose` / `command` / `none`
- 自动发现：扫描常见 frpc 路径、systemd 服务、docker 容器、docker-compose 文件
- frpc webServer 一键启用
- **安全**：scrypt 登录密码 hash、登录失败 IP 限速、configPath 白名单、admin-api 密码 AES-256-GCM 加密存储、command 策略二次确认 + 默认密码锁定

---

## 部署方式

### 方式 A：从 Docker Hub 拉镜像（推荐）

主分支每次合入自动构建，镜像名：[`myfinal12/frp-manager`](https://hub.docker.com/r/myfinal12/frp-manager)

可用 tag：

| Tag | 含义 |
| --- | --- |
| `latest` | main 最新 |
| `sha-xxxxxxx` | 精确 commit，**生产环境推荐** |
| `1.2.3` / `1.2` / `1` | 语义化版本（push 了 `vX.Y.Z` tag 才会有） |

#### 步骤

```bash
# 1. 在服务器上准备目录
mkdir -p /opt/frp-manager && cd /opt/frp-manager

# 2. 拷一份 docker-compose.prod.yml 过来
#    可以直接 wget raw 链接，也可以手动复制
wget https://raw.githubusercontent.com/<your-gh-user>/frp-manager/main/docker-compose.prod.yml

# 3. 写 .env，至少设置镜像和 frpc 配置目录
cat > .env <<EOF
IMAGE=myfinal12/frp-manager
TAG=latest
TZ=Asia/Shanghai
EOF

# 4. 拉镜像 + 起容器
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# 5. 升级（之后只要这两行）
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

访问 `http://<host>:3000`，首屏会跳到 **Setup** 页：
1. 填写 frpc 配置路径（**宿主真实路径**，例如 `/opt/dockerApp/frpc/frpc.toml`，与挂载到容器内路径一致）
2. 选 reload 策略（容器场景推荐 `admin-api` 或 `docker-compose`）
3. 测试 → 保存

#### 国内拉 Docker Hub 慢/不通

`/etc/docker/daemon.json`：
```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://docker.1ms.run"
  ],
  "ipv6": false
}
```
`sudo systemctl restart docker`，再 `docker pull myfinal12/frp-manager:latest`。

---

### 方式 B：源码构建（开发 / 自定义）

仓库根目录的 `Dockerfile` 和 `docker-compose.yml` 走多阶段构建：内置 Node 运行时 + 静态前端 + `docker` CLI（含 compose 插件）。

```bash
git clone https://github.com/<your-gh-user>/frp-manager.git
cd frp-manager
docker compose up -d --build
```

升级：
```bash
git pull
docker compose up -d --build
```

> `runtime/profile.json` 由 volume 持久化，升级不丢配置。

---

## 关键挂载

无论方式 A 还是 B，挂载语义一致：

| 宿主路径 | 容器路径 | 用途 |
| --- | --- | --- |
| `./runtime` | `/app/runtime` | 持久化 `profile.json`，必须 |
| `/opt/dockerApp/frpc` | `/opt/dockerApp/frpc` | frpc 配置目录，**路径保持一致**便于 Setup 页直接填宿主路径。挂目录而非单文件——备份 `<name>.bak.<ts>` 要写在同目录 |
| `/var/run/docker.sock` | `/var/run/docker.sock` | 让容器内 `docker` / `docker compose` 操作宿主 frpc 容器（仅 reload 策略 = `docker` / `docker-compose` 时需要） |

> 用别的目录就改 `docker-compose.prod.yml` 里的 volumes 那行。

---

## Reload 策略与容器的搭配
- **admin-api**：最干净。frpc 启用 `webServer` 后，容器通过网络调用，无须挂 socket。`baseUrl` 用宿主 IP（或 `host.docker.internal`，加 `extra_hosts: ["host.docker.internal:host-gateway"]`）。
- **docker / docker-compose**：必须挂 `/var/run/docker.sock`；`docker-compose` 策略还要把宿主的 `docker-compose.yml` 挂到容器内**相同路径**。
- **systemctl**：不推荐在容器内使用。
- **command**：执行的是**容器内**的 shell 命令，慎用。默认密码 `admin` 下会被服务端直接拒绝；启用时 UI 会弹窗要求完整重新键入一遍命令，写入 profile.json 与每次 reload 执行都会打 audit 日志到 stderr。

---

## 环境变量启动锁定（可选）
跳过 Setup 页直接锁死配置：
```yaml
environment:
  FRPC_CONFIG_PATH: /opt/dockerApp/frpc/frpc.toml
  FRPC_RELOAD_TYPE: admin-api
  FRPC_ADMIN_BASE_URL: http://host.docker.internal:7400
```
完整变量列表见 `packages/config-core/src/profile.service.ts`。

---

## 健康检查
镜像内置 `HEALTHCHECK`，调用 `/api/health`。`docker ps` 会显示 `(healthy)`。

---

## 本地开发

### 环境要求
- Node.js ≥ 20
- npm ≥ 10（自带 workspaces 支持）

### 启动步骤

**1. 一定要在仓库根目录执行 `npm install`**（这是个 npm workspaces monorepo）：

```bash
# 仓库根目录，不是 apps/server
cd <repo-root>
npm install
```

> ⚠️ 不要在 `apps/server` 或 `apps/web` 里单独 `npm install`——子包没有自己的 `node_modules`，依赖统一装在根目录。

**2. 起后端**（任选一种）：

```bash
# 方式 A：在仓库根目录
npm run dev:server

# 方式 B：进 apps/server
cd apps/server
npm run dev
```

后端用 `tsx watch` 直接跑 TypeScript 源码，**不需要也不应该 `npm run build`**。  
监听 `http://localhost:3000`，启动后会打印：

```
[FRP Manager] Server running on http://localhost:3000
[FRP Manager] Profile path: <repo>/runtime/profile.json
[FRP Manager] Auth path:    <repo>/config/auth.json
```

> `npm run start` 是生产命令，跑 `node dist/index.js`，需要先 `npm run build`。本地开发**别用** `start`。

**3. 起前端**（另开一个终端）：

```bash
# 方式 A：在仓库根目录
npm run dev:web

# 方式 B：进 apps/web
cd apps/web
npm run dev
```

前端开在 `http://localhost:5500`，vite 已配置 `/api` 代理到 `:3000`，无需跨域配置。

### 首次登录

打开 `http://localhost:5500`，会重定向到登录页。

- 默认密码：**`admin`**（首次启动后端时自动写入 `config/auth.json`）
- **强烈建议首次登录后立即修改密码**：点左下角「修改密码」按钮，或右上角黄色横条的「立即修改」
  - 新密码至少 6 位；勾选「轮转 token 密钥」可让其它设备立即被踢
  - 在密码未修改前，`command` reload 策略会被服务端拒绝保存（403 `DEFAULT_PASSWORD_BLOCKS_COMMAND`）
- 密码以 `scrypt:<salt>:<hash>` 形式存储；同一 `secret` 被用于 token 签名 + admin-api 密码字段加密
- 旧版 v1 明文 `password` 会在首次启动时自动 hash 并升级到 v2 格式
- 忘记密码：停服，手动编辑 `config/auth.json` 把整个文件删除 → 重启 → 默认密码 `admin` 会被重新生成
- `config/auth.json` 已在 `.gitignore` 中，不会被提交

### 登录限速

同一 IP 连续 8 次登录失败 → 自动锁定 15 分钟（返回 429）。进程重启后计数清零。

### 路径白名单（生产环境强烈建议配置）

默认情况下，Setup 页填的 `configPath` 不做路径限制。为防止越权读写其他系统文件，设置：

```bash
# 多个根目录用分号 ; 分隔（Windows / Linux 都一样）
export FRP_MANAGER_ALLOWED_CONFIG_ROOTS="/opt/dockerApp/frpc;/etc/frp"
```

任何落在白名单外的路径（包括 `..` 穿越）都会返回 403。

### 常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| `Cannot find module 'dist/index.js'` | 你执行了 `npm run start`。本地开发请用 `npm run dev`。 |
| `Cannot find module 'express'` | 没在**根目录**装依赖。回到仓库根 `npm install`。 |
| `UNKNOWN: unknown error, open '...package-lock.json'` | Windows 文件被另一个 npm/编辑器/IDE 索引进程占用。关闭其他 npm 进程、退出 VSCode 文件锁定，或重启 IDE 后再试。 |
| `tsx 不是内部或外部命令` | 同上，根目录没 `npm install`。 |
| 前端登录提示 `Network Error` | 后端没起来，或起在了别的端口。先确认 `:3000` 通。 |

### 可选：构建产物本地跑一遍（模拟容器）

```bash
# 在根目录
npm run build              # 同时构建 web 静态产物 + 也会触发 server 的 tsc（如果配了）
cd apps/server
npm run start              # node dist/index.js，端口同样 3000，会顺便托管 web/dist
```

---

## 国内服务器源码构建加速（仅方式 B 相关）

构建会拉三类资源，国内访问任一都可能超时。Dockerfile / docker-compose.yml 已**默认启用国内镜像**：

| 资源 | 默认源（国内） | 备选 |
| --- | --- | --- |
| 基础镜像 `node:20-alpine` | `docker.m.daocloud.io/library/node:20-alpine` | `docker.1ms.run/library/node:20-alpine` |
| apk 系统包 | `mirrors.tuna.tsinghua.edu.cn/alpine` | `mirrors.aliyun.com/alpine` / `mirrors.ustc.edu.cn/alpine` |
| npm 包 | `registry.npmmirror.com` | （已是 npm 官方镜像最快源） |

通过 `.env` 覆盖：
```
NODE_IMAGE=docker.1ms.run/library/node:20-alpine
APK_MIRROR=https://mirrors.aliyun.com/alpine
NPM_REGISTRY=https://registry.npmmirror.com
```

> IPv6 路由到 `*.docker.io` 不通但 IPv4 正常时，在 `/etc/docker/daemon.json` 里加 `"ipv6": false` 后重启 docker。

---

## CI/CD

`.github/workflows/docker-publish.yml` 自动构建镜像并推 Docker Hub。

| 触发 | 行为 |
| --- | --- |
| push 到 `main` | build + push（`latest` + `sha-xxxxxxx`） |
| push tag `v1.2.3` | build + push（`1.2.3` / `1.2` / `1` / `latest`） |
| 其它分支 / PR | **不触发** |
| 手动 Run workflow | 可指定额外 tag |

详细配置和 Secrets 设置见 `.github/workflows/README.md`。
