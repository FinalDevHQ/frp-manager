import { Router, type Request, type Response, type NextFunction } from "express"
import { executeReload } from "@frp-manager/config-core"
import type { AppContext } from "../context"

export function createSystemRouter(ctx: AppContext): Router {
  const router = Router()

  /**
   * 根据当前 profile.reload 策略执行 reload。
   * 无 profile 时返回 412 PROFILE_NOT_CONFIGURED。
   */
  router.post("/reload", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await ctx.getProfile()
      if (!profile) {
        const err = new Error("PROFILE_NOT_CONFIGURED")
        err.name = "ProfileNotConfiguredError"
        throw err
      }
      const result = await executeReload(profile.reload)
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
