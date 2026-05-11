import { Router } from "express"
import { healthRouter } from "./health"
import { createProxyRouter } from "./proxy"
import { createConfigRouter } from "./config"
import { createSystemRouter } from "./system"
import type { AppContext } from "../context"

export function createApiRouter(ctx: AppContext): Router {
  const router = Router()
  router.use("/health", healthRouter)
  router.use("/proxies", createProxyRouter(ctx))
  router.use("/config", createConfigRouter(ctx))
  router.use("/system", createSystemRouter(ctx))
  return router
}
