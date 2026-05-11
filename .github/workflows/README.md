# GitHub Actions 配置

## docker-publish.yml

构建 Docker 镜像并推送到 Docker Hub。

### 必须配置的 Secrets

仓库 `Settings → Secrets and variables → Actions → New repository secret`：

| 名称 | 说明 |
| --- | --- |
| `DOCKERHUB_USERNAME` | 你的 Docker Hub 用户名 |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token（**不是登录密码**） |

> 生成 Access Token：[https://app.docker.com/settings/personal-access-tokens](https://app.docker.com/settings/personal-access-tokens)
> 选 `Read, Write, Delete` 权限即可。

### 可选 Variables（不是 Secret）

仓库 `Settings → Secrets and variables → Actions → Variables`：

| 名称 | 默认值 | 说明 |
| --- | --- | --- |
| `IMAGE_NAME` | `${DOCKERHUB_USERNAME}/frp-manager` | 镜像完整名。想用组织/不同 repo 名时设这个 |

### 触发方式

| 场景 | 行为 |
| --- | --- |
| push 到 `main` / `master` | build + push，打 `latest` 和 `sha-xxxxxxx` 两个 tag |
| push tag `v1.2.3` | build + push，打 `1.2.3`、`1.2`、`1`、`latest` |
| 提 PR | 只 build 验证，不 push |
| 手动 `Run workflow` | 可指定额外 tag，比如 `manual-2026-05` |

### 镜像标签策略

```
youruser/frp-manager:latest             ← main 分支最新
youruser/frp-manager:sha-a1b2c3d        ← 任何一次 push 的精确版本
youruser/frp-manager:1.2.3              ← v1.2.3 tag
youruser/frp-manager:1.2                ← v1.2 系列最新
youruser/frp-manager:1                  ← v1 系列最新
```

生产环境推荐 pin 到 `sha-xxx` 或 `1.2.3`，避免 `latest` 飘。

### 构建优化

- 用 `docker/setup-buildx-action` + `cache-from/to: type=gha`，第二次构建命中缓存基本秒过。
- `build-args` 把国内镜像源默认值覆盖回上游源（GitHub Runner 在境外，国内代理反而慢）。
- 仅构建 `linux/amd64`（你的部署环境），需要 ARM 加 `linux/arm64` 即可。

### 部署端使用

把 `docker-compose.prod.yml` 拷到 Debian，配 `.env` 写 `IMAGE` `TAG`：

```bash
# 服务器上
cat > .env <<EOF
IMAGE=youruser/frp-manager
TAG=latest
EOF

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```
