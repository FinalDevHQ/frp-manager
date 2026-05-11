import type { ErrorRequestHandler } from "express"
import { ValidationException } from "@frp-manager/config-core"
import { PROFILE_NOT_CONFIGURED } from "@frp-manager/shared"

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof Error && err.name === "ProfileNotConfiguredError") {
    res.status(412).json({ success: false, error: PROFILE_NOT_CONFIGURED })
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
