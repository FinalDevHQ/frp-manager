import type { Request, Response, NextFunction } from "express"
import type { AuthService } from "../auth"
import { extractToken } from "../routes/auth"

/**
 * 守卫所有受保护的 /api/* 端点。
 * 鉴别失败统一返回 401 + { error: "UNAUTHENTICATED" }，前端拦截后跳转 /login。
 */
export function createAuthMiddleware(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = extractToken(req)
      const ok = await authService.verifyToken(token)
      if (!ok) {
        res.status(401).json({ success: false, error: "UNAUTHENTICATED" })
        return
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}
