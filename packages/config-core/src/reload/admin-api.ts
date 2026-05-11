import type { AdminApiStrategy, ReloadResult } from "@frp-manager/shared"

const TIMEOUT_MS = 8_000

/**
 * 调用 frpc 自带的 admin webServer：POST {baseUrl}/api/reload
 * frpc 0.52+ 支持；更早版本可能返回 404
 */
export async function reloadAdminApi(strategy: AdminApiStrategy): Promise<ReloadResult> {
  const base = strategy.baseUrl.replace(/\/$/, "")
  const url = `${base}/api/reload`

  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (strategy.user && strategy.password) {
    const token = Buffer.from(`${strategy.user}:${strategy.password}`).toString("base64")
    headers.Authorization = `Basic ${token}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, { method: "GET", headers, signal: controller.signal })
    // frpc GET /api/reload 会触发重载；部分版本也支持 POST，这里用 GET 兼容面最广
    const text = await res.text()
    if (res.ok) {
      return {
        reloaded: true,
        message: `${url} → ${res.status} ${text || "OK"}`,
        strategyType: "admin-api",
      }
    }
    return {
      reloaded: false,
      message: `${url} 返回 ${res.status} ${text}`,
      strategyType: "admin-api",
    }
  } catch (err: unknown) {
    const msg = (err as Error).name === "AbortError" ? `请求超时（${TIMEOUT_MS}ms）` : (err as Error).message
    return {
      reloaded: false,
      message: `Admin API 调用失败: ${msg}`,
      strategyType: "admin-api",
    }
  } finally {
    clearTimeout(timer)
  }
}
