import path from "node:path"
import { existsSync } from "node:fs"
import express from "express"
import cors from "cors"
import { createApiRouter } from "./routes"
import { createContext } from "./context"
import { errorHandler } from "./middleware/error"

const app = express()
const PORT = Number(process.env.PORT) || 3000
const ctx = createContext()

app.use(cors())
app.use(express.json())

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
