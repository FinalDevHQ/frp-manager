/**
 * 进程内登录限速：同一 IP 在 WINDOW_MS 内累计 FAIL_LIMIT 次失败 → 锁定 LOCK_MS。
 * 仅用于守护 /api/auth/login，避免把弱密码暴破成功概率拉到极高。
 *
 * 简单的 Map<ip, state> 即可，重启后清零（被锁的 IP 也会被解锁，可接受）。
 */

const FAIL_LIMIT = 8
const WINDOW_MS = 15 * 60_000
const LOCK_MS = 15 * 60_000

interface LoginState {
  fails: number
  windowStartedAt: number
  lockedUntil: number
}

const states = new Map<string, LoginState>()

export class RateLimitedError extends Error {
  constructor(public readonly retryAfterSec: number) {
    super(`RATE_LIMITED`)
    this.name = "RateLimitedError"
  }
}

export function ensureLoginAllowed(ip: string): void {
  const now = Date.now()
  const s = states.get(ip)
  if (!s) return
  if (s.lockedUntil > now) {
    throw new RateLimitedError(Math.ceil((s.lockedUntil - now) / 1000))
  }
  // 窗口已过 → 重置
  if (now - s.windowStartedAt > WINDOW_MS) {
    states.delete(ip)
  }
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now()
  const s = states.get(ip)
  if (!s || now - s.windowStartedAt > WINDOW_MS) {
    states.set(ip, { fails: 1, windowStartedAt: now, lockedUntil: 0 })
    return
  }
  s.fails += 1
  if (s.fails >= FAIL_LIMIT) {
    s.lockedUntil = now + LOCK_MS
    console.warn(
      `[FRP Manager][AUDIT] login rate-limited: ip=${ip} fails=${s.fails} locked_until=${new Date(
        s.lockedUntil,
      ).toISOString()}`,
    )
  }
}

export function recordLoginSuccess(ip: string): void {
  states.delete(ip)
}
