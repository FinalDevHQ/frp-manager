import { promises as fs } from "node:fs"
import { Router, type Request, type Response, type NextFunction } from "express"
import type { DeploymentProfile } from "@frp-manager/shared"
import { discover, enableWebServer, parseWebServer, testProfile } from "@frp-manager/config-core"
import type { AppContext } from "../context"

export function createProfileRouter(ctx: AppContext): Router {
  const router = Router()

  router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await ctx.getProfile()
      res.json({ success: true, data: profile })
    } catch (err) {
      next(err)
    }
  })

  router.put("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as DeploymentProfile
      const errors = validateProfile(input)
      if (errors.length > 0) {
        res.status(400).json({ success: false, error: errors.join("; ") })
        return
      }
      const saved = await ctx.profileService.write(input)
      res.json({ success: true, data: saved })
    } catch (err) {
      next(err)
    }
  })

  router.post("/test", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = req.body as DeploymentProfile
      const errors = validateProfile(profile)
      if (errors.length > 0) {
        res.status(400).json({ success: false, error: errors.join("; ") })
        return
      }
      const result = await testProfile(profile)
      res.json({ success: true, data: result })
    } catch (err) {
      next(err)
    }
  })

  /**
   * 检查指定 frpc.yml 是否启用了 webServer
   * body: { configPath: string }
   */
  router.post("/inspect-admin", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const configPath = (req.body?.configPath as string | undefined)?.trim()
      if (!configPath) {
        res.status(400).json({ success: false, error: "configPath 不能为空" })
        return
      }
      let text = ""
      try {
        text = await fs.readFile(configPath, "utf8")
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          res.json({ success: true, data: { enabled: false } })
          return
        }
        throw err
      }
      const info = parseWebServer(text)
      res.json({ success: true, data: info })
    } catch (err) {
      next(err)
    }
  })

  /**
   * 向 frpc.yml 写入 webServer 配置。
   * body: { configPath: string, addr?: string, port?: number, user?: string, password?: string }
   */
  router.post("/enable-admin", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { configPath, addr, port, user, password } = req.body as {
        configPath?: string
        addr?: string
        port?: number
        user?: string
        password?: string
      }
      if (!configPath?.trim()) {
        res.status(400).json({ success: false, error: "configPath 不能为空" })
        return
      }
      const info = await enableWebServer(configPath, { addr, port, user, password })
      res.json({ success: true, data: info })
    } catch (err) {
      next(err)
    }
  })

  /** 扫描常见 frpc.yml 路径 + systemd 服务 + docker 容器 */
  router.get("/suggestions", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await discover()
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  })

  return router
}

function validateProfile(p: DeploymentProfile | undefined): string[] {
  const errs: string[] = []
  if (!p) return ["请求体不能为空"]
  if (!p.configPath?.trim()) errs.push("configPath 不能为空")
  if (!p.reload?.type) errs.push("reload.type 不能为空")
  else {
    switch (p.reload.type) {
      case "systemctl":
        if (!p.reload.serviceName) errs.push("systemctl.serviceName 不能为空")
        if (!["reload", "restart"].includes(p.reload.action))
          errs.push("systemctl.action 必须为 reload 或 restart")
        if (!["system", "user"].includes(p.reload.scope))
          errs.push("systemctl.scope 必须为 system 或 user")
        break
      case "admin-api":
        if (!p.reload.baseUrl) errs.push("admin-api.baseUrl 不能为空")
        break
      case "docker":
        if (!p.reload.container) errs.push("docker.container 不能为空")
        break
      case "docker-compose":
        if (!p.reload.service) errs.push("docker-compose.service 不能为空")
        if (!["restart", "up", "kill-hup"].includes(p.reload.action))
          errs.push("docker-compose.action 必须为 restart / up / kill-hup")
        break
      case "command":
        if (!p.reload.command?.trim()) errs.push("command.command 不能为空")
        break
    }
  }
  return errs
}
