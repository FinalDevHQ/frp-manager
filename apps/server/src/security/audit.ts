import type { Request } from "express"

export function clientIp(req: Request): string {
  // Express 信任反代时会用 X-Forwarded-For；这里直接用 socket，避免被伪造
  return req.socket.remoteAddress ?? req.ip ?? "unknown"
}

/**
 * 审计日志：高敏感操作（command 执行、改密、配置写入到非常规路径等）统一打到 stdout。
 * 不写文件，避免在容器场景多一份持久化目录。需要采集时由 docker logs / journald 捕获。
 */
export function audit(event: string, details: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    audit: event,
    ...details,
  })
  console.warn(`[FRP Manager][AUDIT] ${line}`)
}
