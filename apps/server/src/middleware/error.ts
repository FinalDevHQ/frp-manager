import type { ErrorRequestHandler } from "express"
import { ValidationException } from "@frp-manager/config-core"
import { PROFILE_NOT_CONFIGURED } from "@frp-manager/shared"
import { ForbiddenPathError } from "../security/paths"
import { RateLimitedError } from "../security/rate-limit"

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof Error && err.name === "ProfileNotConfiguredError") {
    res.status(412).json({ success: false, error: PROFILE_NOT_CONFIGURED })
    return
  }
  if (err instanceof ForbiddenPathError) {
    res.status(403).json({ success: false, error: `路径不在允许范围: ${err.attemptedPath}` })
    return
  }
  if (err instanceof RateLimitedError) {
    res.setHeader("Retry-After", String(err.retryAfterSec))
    res
      .status(429)
      .json({ success: false, error: `登录失败次数过多，${err.retryAfterSec}s 后再试` })
    return
  }
  if (err instanceof ValidationException) {
    res.status(400).json({
      success: false,
      error: err.message,
      details: err.errors,
    })
    return
  }
  const message = err instanceof Error ? err.message : "Unknown error"
  console.error("[FRP Manager] Unhandled error:", err)
  res.status(500).json({ success: false, error: message })
}
