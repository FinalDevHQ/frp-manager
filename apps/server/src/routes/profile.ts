import { promises as fs } from "node:fs"
import { Router, type Request, type Response, type NextFunction } from "express"
import type { DeploymentProfile, ReloadStrategy } from "@frp-manager/shared"
import {
  detectFormat,
  discover,
  enableWebServer,
  parseWebServer,
  testProfile,
} from "@frp-manager/config-core"
import type { AppContext } from "../context"
import { assertPathAllowed } from "../security/paths"
import {
  encryptStrategyForStorage,
  isEncrypted,
  isMasked,
  maskStrategyForClient,
  unmaskStrategyForExecute,
  MASKED_PASSWORD,
} from "../security/crypto"
import { audit, clientIp } from "../security/audit"

export function createProfileRouter(ctx: AppContext): Router {
  const router = Router()

  router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await ctx.getProfile()
      if (!profile) {
        res.json({ success: true, data: null })
        return
      }
      // 出站：把 admin-api 密码替换为 ***，避免明文/密文泄露给前端
      const masked: DeploymentProfile = {
        ...profile,
        reload: maskStrategyForClient(profile.reload),
      }
      res.json({ success: true, data: masked })
    } catch (err) {
      next(err)
    }
  })

  router.put("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as DeploymentProfile & { confirmCommand?: boolean }
      const errors = validateProfile(input)
      if (errors.length > 0) {
        res.status(400).json({ success: false, error: errors.join("; ") })
        return
      }
      // 路径白名单
      input.configPath = assertPathAllowed(input.configPath)

      // command 策略守卫：默认密码下禁用 + 必须二次确认
      if (input.reload.type === "command") {
        if (await ctx.authService.isPasswordDefault()) {
          res.status(403).json({
            success: false,
            error: "DEFAULT_PASSWORD_BLOCKS_COMMAND",
          })
          return
        }
        if (!input.confirmCommand) {
          res.status(400).json({
            success: false,
            error: "CONFIRM_COMMAND_REQUIRED",
          })
          return
        }
        audit("command_strategy_saved", {
          ip: clientIp(req),
          command: input.reload.command,
        })
      }

      // 入站密码处理：MASKED_PASSWORD 表示「保持原值」，否则按需加密
      const existing = await ctx.profileService.read()
      const reload = await reconcileReload(input.reload, existing?.reload, ctx)
      const saved = await ctx.profileService.write({
        ...input,
        reload,
      })
      const responsePayload: DeploymentProfile = {
        ...saved,
        reload: maskStrategyForClient(saved.reload),
      }
      res.json({ success: true, data: responsePayload })
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
      profile.configPath = assertPathAllowed(profile.configPath)

      // test 时若密码是 MASKED，则用现有持久化的解密值替换；否则原样使用
      const existing = await ctx.profileService.read()
      const reload = await reconcileReload(profile.reload, existing?.reload, ctx)
      const secret = await ctx.authService.getSecret()
      const result = await testProfile({
        ...profile,
        reload: unmaskStrategyForExecute(reload, secret),
      })
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
      const rawPath = (req.body?.configPath as string | undefined)?.trim()
      if (!rawPath) {
        res.status(400).json({ success: false, error: "configPath 不能为空" })
        return
      }
      const configPath = assertPathAllowed(rawPath)
      // 路径不存在 / 是目录 / 不可读 → 都视为「未启用」，避免输入未完成时刷错误日志
      let text = ""
      try {
        const stat = await fs.stat(configPath)
        if (!stat.isFile()) {
          res.json({ success: true, data: { enabled: false } })
          return
        }
        text = await fs.readFile(configPath, "utf8")
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException).code
        if (code === "ENOENT" || code === "EISDIR" || code === "EACCES" || code === "EPERM") {
          res.json({ success: true, data: { enabled: false } })
          return
        }
        throw err
      }
      const info = parseWebServer(text, detectFormat(configPath))
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
      const safePath = assertPathAllowed(configPath)
      audit("enable_admin", { ip: clientIp(req), configPath: safePath })
      const info = await enableWebServer(safePath, { addr, port, user, password })
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

/**
 * 入站 reload 与已持久化 reload 的合并：
 *   - admin-api：incoming.password 若为 MASKED_PASSWORD 或空 → 沿用 existing 加密值；
 *                否则用 incoming 明文，存储前会被 encryptStrategyForStorage 加密
 *   - 其它策略：原样返回（不需要密码合并）
 * 最后统一调用 encryptStrategyForStorage 把明文加密。
 */
async function reconcileReload(
  incoming: ReloadStrategy,
  existing: ReloadStrategy | undefined,
  ctx: AppContext,
): Promise<ReloadStrategy> {
  const secret = await ctx.authService.getSecret()
  if (incoming.type === "admin-api") {
    const existingPwd =
      existing && existing.type === "admin-api" ? existing.password : undefined
    let pwd = incoming.password
    if (!pwd || isMasked(pwd)) {
      // 保持原值（已加密则继续加密；undefined 则保持 undefined）
      return { ...incoming, password: existingPwd }
    }
    if (isEncrypted(pwd)) {
      // 客户端不应发回密文，但为防御性兼容：直接保留
      return { ...incoming, password: pwd }
    }
    return encryptStrategyForStorage({ ...incoming, password: pwd }, secret)
  }
  return incoming
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
