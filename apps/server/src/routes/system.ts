import { Router, type Request, type Response } from "express"
import type { AppContext } from "../context"

export function createSystemRouter(ctx: AppContext): Router {
  const router = Router()

  /**
   * v1：占位实现，不实际 reload。
   * 后续接入 systemctl / child_process 重启逻辑。
   */
  router.post("/reload", (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        reloaded: false,
        message: "Reload 暂未实现，v1 仅保存配置文件",
      },
    })
  })

  router.get("/status", (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        running: false,
        configPath: ctx.configService.getConfigPath(),
        lastSavedAt: ctx.lastSavedAt,
      },
    })
  })

  return router
}
