import { Router, type Request, type Response, type NextFunction } from "express"
import { executeReload } from "@frp-manager/config-core"
import type { AppContext } from "../context"
import { unmaskStrategyForExecute } from "../security/crypto"
import { audit, clientIp } from "../security/audit"

export function createSystemRouter(ctx: AppContext): Router {
  const router = Router()

  /**
   * 根据当前 profile.reload 策略执行 reload。
   * 无 profile 时返回 412 PROFILE_NOT_CONFIGURED。
   * 执行前解密 admin-api 密码；执行 command 策略时打审计日志。
   */
  router.post("/reload", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await ctx.getProfile()
      if (!profile) {
        const err = new Error("PROFILE_NOT_CONFIGURED")
        err.name = "ProfileNotConfiguredError"
        throw err
      }
      const secret = await ctx.authService.getSecret()
      const strategy = unmaskStrategyForExecute(profile.reload, secret)
      if (strategy.type === "command") {
        audit("command_executed", {
          ip: clientIp(req),
          command: strategy.command,
        })
      }
      const result = await executeReload(strategy)
      ctx.lastReload = { ...result, at: Date.now() }
      res.json({ success: true, data: result })
    } catch (err) {
      next(err)
    }
  })

  router.get("/status", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await ctx.getProfile()
      res.json({
        success: true,
        data: {
          running: false,
          configPath: profile?.configPath ?? "",
          lastSavedAt: ctx.lastSavedAt,
        },
      })
    } catch (err) {
      next(err)
    }
  })

  return router
}
