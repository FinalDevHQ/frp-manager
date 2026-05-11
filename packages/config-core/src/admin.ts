import { promises as fs } from "node:fs"
import { parse, stringify } from "yaml"

export interface WebServerInfo {
  enabled: boolean
  addr?: string
  port?: number
  user?: string
  password?: string
  /** 构造好的 baseUrl，如 http://127.0.0.1:7400 */
  baseUrl?: string
}

/**
 * 从 frpc.yml 文本中提取 webServer 配置
 */
export function parseWebServer(yamlText: string): WebServerInfo {
  if (!yamlText.trim()) return { enabled: false }
  const raw = parse(yamlText) as Record<string, unknown> | null
  const ws = raw?.webServer as
    | { addr?: string; port?: number; user?: string; password?: string }
    | undefined

  if (!ws || typeof ws !== "object") return { enabled: false }
  const addr = ws.addr ?? "127.0.0.1"
  const port = ws.port ?? 7400
  return {
    enabled: true,
    addr,
    port,
    user: ws.user,
    password: ws.password,
    baseUrl: `http://${addr}:${port}`,
  }
}

export interface EnableAdminOptions {
  addr?: string
  port?: number
  user?: string
  password?: string
}

/**
 * 在 frpc.yml 里插入/更新 webServer 配置。
 * 保留其它所有字段。
 */
export async function enableWebServer(
  configPath: string,
  options: EnableAdminOptions = {},
): Promise<WebServerInfo> {
  let text = ""
  try {
    text = await fs.readFile(configPath, "utf8")
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
  }

  const parsed = (text.trim() ? parse(text) : {}) as Record<string, unknown>
  const doc = parsed && typeof parsed === "object" ? parsed : {}

  const addr = options.addr ?? "127.0.0.1"
  const port = options.port ?? 7400
  const webServer: Record<string, unknown> = { addr, port }
  if (options.user) webServer.user = options.user
  if (options.password) webServer.password = options.password

  doc.webServer = webServer

  await fs.writeFile(configPath, stringify(doc, { lineWidth: 0 }), "utf8")

  return {
    enabled: true,
    addr,
    port,
    user: options.user,
    password: options.password,
    baseUrl: `http://${addr}:${port}`,
  }
}
