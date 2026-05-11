import { Router, type Request, type Response, type NextFunction } from "express"
import type { AuthService } from "../auth"
import {
  ensureLoginAllowed,
  recordLoginFailure,
  recordLoginSuccess,
} from "../security/rate-limit"
import { audit, clientIp } from "../security/audit"

export function createAuthRouter(authService: AuthService): Router {
  const router = Router()

  /** 登录：成功返回 token，失败 401，触发限流时 429 */
  router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
    const ip = clientIp(req)
    try {
      ensureLoginAllowed(ip)
      const password = (req.body?.password ?? "") as string
      if (typeof password !== "string" || password.length === 0) {
        res.status(400).json({ success: false, error: "密码不能为空" })
        return
      }
      const ok = await authService.verifyPassword(password)
      if (!ok) {
        recordLoginFailure(ip)
        audit("login_failed", { ip })
        res.status(401).json({ success: false, error: "密码错误" })
        return
      }
      recordLoginSuccess(ip)
      const { token, expiresAt } = await authService.issueToken()
      audit("login_success", { ip })
      res.json({ success: true, data: { token, expiresAt } })
    } catch (err) {
      next(err)
    }
  })

  /** 状态：探测当前请求所携带 token 是否有效，并暴露默认密码标志 */
  router.get("/status", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = extractToken(req)
      const authenticated = await authService.verifyToken(token)
      const passwordIsDefault = await authService.isPasswordDefault()
      res.json({ success: true, data: { authenticated, passwordIsDefault } })
    } catch (err) {
      next(err)
    }
  })

  /**
   * 修改密码（必须先登录通过外层鉴权中间件）。
   * body: { oldPassword, newPassword, rotateSecret? }
   * rotateSecret=true → 让所有已签发 token 立即失效。
   */
  router.post(
    "/change-password",
    async (req: Request, res: Response, next: NextFunction) => {
      const ip = clientIp(req)
      try {
        const oldPassword = (req.body?.oldPassword ?? "") as string
        const newPassword = (req.body?.newPassword ?? "") as string
        const rotateSecret = !!req.body?.rotateSecret
        if (!oldPassword || !newPassword) {
          res.status(400).json({ success: false, error: "旧密码和新密码不能为空" })
          return
        }
        try {
          const result = await authService.changePassword(oldPassword, newPassword, {
            rotateSecret,
          })
          audit("password_changed", { ip, rotated: result.rotated })
          // 改密后无论是否轮转 secret 都签发新 token，避免前端立即被踢
          const { token, expiresAt } = await authService.issueToken()
          res.json({ success: true, data: { rotated: result.rotated, token, expiresAt } })
        } catch (err) {
          if (err instanceof Error && err.name === "OldPasswordInvalidError") {
            audit("password_change_failed", { ip, reason: "old_password_invalid" })
            res.status(401).json({ success: false, error: "原密码错误" })
            return
          }
          if (err instanceof Error && err.name === "WeakPasswordError") {
            res
              .status(400)
              .json({ success: false, error: "新密码长度至少 6 位" })
            return
          }
          throw err
        }
      } catch (err) {
        next(err)
      }
    },
  )

  return router
}

export function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization
  if (!header) return undefined
  const m = /^Bearer\s+(.+)$/i.exec(header.trim())
  return m ? m[1] : undefined
}
