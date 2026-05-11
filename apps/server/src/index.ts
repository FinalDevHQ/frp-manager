import path from "node:path"
import { existsSync } from "node:fs"
import express from "express"
import cors from "cors"
import { createApiRouter } from "./routes"
import { createAuthRouter } from "./routes/auth"
import { healthRouter } from "./routes/health"
import { createContext } from "./context"
import { errorHandler } from "./middleware/error"
import { createAuthMiddleware } from "./middleware/auth"
import { AuthService, resolveAuthPath } from "./auth"
import { getAllowedRoots, isPathRestrictionConfigured } from "./security/paths"

const app = express()
const PORT = Number(process.env.PORT) || 3000
const authService = new AuthService(resolveAuthPath())
const ctx = createContext(authService)

// CORS：默认禁止跨域（同源访问不受影响），通过 FRP_MANAGER_CORS_ORIGINS 显式放行
const corsOriginsRaw = (process.env.FRP_MANAGER_CORS_ORIGINS ?? "").trim()
const corsOrigins = corsOriginsRaw
  ? corsOriginsRaw.split(",").map((s) => s.trim()).filter(Boolean)
  : []
if (corsOrigins.length > 0) {
  app.use(cors({ origin: corsOrigins, credentials: false }))
} else {
  // 同源放行；跨域请求得不到 Access-Control-Allow-Origin，会被浏览器拦下
  app.use(cors({ origin: false }))
}
app.use(express.json())

// 公开端点（无需登录）
app.use("/api/health", healthRouter)
app.use("/api/auth", createAuthRouter(authService))

// 守卫：以下所有 /api/* 路由必须携带有效 token
app.use("/api", createAuthMiddleware(authService))
app.use("/api", createApiRouter(ctx))

/**
 * 生产/容器模式：托管 web 静态产物 + SPA fallback。
 * 通过 WEB_DIST_DIR 显式指定，或自动探测 apps/web/dist。
 */
const webDist = resolveWebDist()
if (webDist) {
  console.log(`[FRP Manager] Serving web from ${webDist}`)
  app.use(express.static(webDist, { index: false, maxAge: "1h" }))
  // SPA fallback：所有非 /api 请求回退到 index.html
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"))
  })
}

app.use(errorHandler)

app.listen(PORT, async () => {
  console.log(`[FRP Manager] Server running on http://localhost:${PORT}`)
  console.log(`[FRP Manager] Profile path: ${ctx.profileService.getPath()}`)
  console.log(`[FRP Manager] Auth path:    ${authService.getPath()}`)
  // 提前触发 auth 配置初始化（首次启动会写默认密码 / 升级旧格式 / 警告默认密码）
  await authService.load()
  if (isPathRestrictionConfigured()) {
    console.log(
      `[FRP Manager] Path restriction enabled, allowed roots: ${getAllowedRoots().join(", ")}`,
    )
  } else {
    console.warn(
      `[FRP Manager] WARNING: FRP_MANAGER_ALLOWED_CONFIG_ROOTS 未配置，configPath 入参不做白名单校验。生产环境强烈建议设置。`,
    )
  }
  const profile = await ctx.getProfile()
  if (profile) {
    console.log(`[FRP Manager] Config path: ${profile.configPath}`)
    console.log(`[FRP Manager] Reload strategy: ${profile.reload.type}`)
  } else {
    console.log(`[FRP Manager] No profile configured — open web UI to set up`)
  }
})

function resolveWebDist(): string | null {
  if (process.env.WEB_DIST_DIR) {
    const p = path.resolve(process.env.WEB_DIST_DIR)
    return existsSync(p) ? p : null
  }
  // 容器内典型布局: /app/apps/web/dist；本地开发: 仓库根/apps/web/dist
  const candidates = [
    path.resolve(process.cwd(), "apps/web/dist"),
    path.resolve(process.cwd(), "../web/dist"),
    path.resolve(process.cwd(), "../../apps/web/dist"),
  ]
  return candidates.find((c) => existsSync(path.join(c, "index.html"))) ?? null
}
