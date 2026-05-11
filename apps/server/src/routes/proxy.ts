import { Router, type Request, type Response, type NextFunction } from "express"
import type { Proxy } from "@frp-manager/shared"
import {
  addProxy,
  deleteProxy,
  findProxy,
  listProxies,
  updateProxy,
} from "@frp-manager/config-core"
import type { AppContext } from "../context"

type NameParams = { name: string }

export function createProxyRouter(ctx: AppContext): Router {
  const router = Router()

  router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const service = await ctx.requireConfigService()
      const config = await service.read()
      res.json({ success: true, data: listProxies(config) })
    } catch (err) {
      next(err)
    }
  })

  router.get<NameParams>("/:name", async (req, res, next) => {
    try {
      const service = await ctx.requireConfigService()
      const config = await service.read()
      const proxy = findProxy(config, req.params.name)
      if (!proxy) {
        res.status(404).json({ success: false, error: `Proxy "${req.params.name}" 不存在` })
        return
      }
      res.json({ success: true, data: proxy })
    } catch (err) {
      next(err)
    }
  })

  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as Proxy
      const service = await ctx.requireConfigService()
      const config = await service.read()
      const nextConfig = addProxy(config, input)
      const result = await service.save(nextConfig.proxies)
      ctx.lastSavedAt = result.savedAt
      res.status(201).json({ success: true, data: input })
    } catch (err) {
      next(err)
    }
  })

  router.put<NameParams>("/:name", async (req, res, next) => {
    try {
      const input = req.body as Proxy
      const service = await ctx.requireConfigService()
      const config = await service.read()
      const nextConfig = updateProxy(config, req.params.name, input)
      const result = await service.save(nextConfig.proxies)
      ctx.lastSavedAt = result.savedAt
      res.json({ success: true, data: input })
    } catch (err) {
      next(err)
    }
  })

  router.delete<NameParams>("/:name", async (req, res, next) => {
    try {
      const service = await ctx.requireConfigService()
      const config = await service.read()
      const nextConfig = deleteProxy(config, req.params.name)
      const result = await service.save(nextConfig.proxies)
      ctx.lastSavedAt = result.savedAt
      res.json({ success: true, data: { name: req.params.name } })
    } catch (err) {
      next(err)
    }
  })

  return router
}
