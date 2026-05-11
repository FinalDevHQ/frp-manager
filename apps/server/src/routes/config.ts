import { Router, type Request, type Response, type NextFunction } from "express"
import type { Proxy } from "@frp-manager/shared"
import { diffLines } from "@frp-manager/config-core"
import type { AppContext } from "../context"

export function createConfigRouter(ctx: AppContext): Router {
  const router = Router()

  /**
   * 预览基于 body.proxies（或当前已保存 proxies）生成的 YAML，
   * 并返回与当前文件的 diff
   */
  router.post("/preview", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const proxies = (req.body?.proxies as Proxy[] | undefined) ?? null
      const current = await ctx.configService.readRaw()
      const targetProxies = proxies ?? (await ctx.configService.read()).proxies
      const next = await ctx.configService.preview(targetProxies)
      res.json({
        success: true,
        data: {
          current,
          next,
          diff: diffLines(current, next),
        },
      })
    } catch (err) {
      next(err)
    }
  })

  /** 返回当前已保存的 frpc.yml 文本 */
  router.get("/yaml", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const yaml = await ctx.configService.readRaw()
      res.json({ success: true, data: { yaml } })
    } catch (err) {
      next(err)
    }
  })

  /** 用 body.proxies 覆盖式保存 */
  router.post("/save", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const proxies = req.body?.proxies as Proxy[] | undefined
      if (!Array.isArray(proxies)) {
        res.status(400).json({ success: false, error: "请求体必须包含 proxies 数组" })
        return
      }
      const result = await ctx.configService.save(proxies)
      ctx.lastSavedAt = result.savedAt
      res.json({
        success: true,
        data: { savedAt: result.savedAt, backupPath: result.backupPath ?? "" },
      })
    } catch (err) {
      next(err)
    }
  })

  return router
}
