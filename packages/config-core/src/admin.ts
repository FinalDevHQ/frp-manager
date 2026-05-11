import { promises as fs } from "node:fs"
import { parse as parseYaml, stringify as stringifyYaml } from "yaml"
import { parse as parseToml, stringify as stringifyToml } from "smol-toml"
import { detectFormat, type ConfigFormat } from "./format"

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
 * 从 frpc 配置文本中提取 webServer 配置。
 * @param text   配置文件内容（YAML 或 TOML）
 * @param format 文件格式；缺省按 YAML 解析（保持向后兼容）
 */
export function parseWebServer(text: string, format: ConfigFormat = "yaml"): WebServerInfo {
  if (!text.trim()) return { enabled: false }
  const parsed = format === "toml" ? parseToml(text) : parseYaml(text)
  const raw = parsed as Record<string, unknown> | null
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
 * 在 frpc 配置文件里插入/更新 webServer 配置，保留其它所有字段。
 * 文件格式按 configPath 后缀自动判定（.toml → TOML，其它 → YAML）。
 */
export async function enableWebServer(
  configPath: string,
  options: EnableAdminOptions = {},
): Promise<WebServerInfo> {
  const format = detectFormat(configPath)

  let text = ""
  try {
    text = await fs.readFile(configPath, "utf8")
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
  }

  const parsed = (text.trim() ? (format === "toml" ? parseToml(text) : parseYaml(text)) : {}) as
    | Record<string, unknown>
    | null
  const doc = parsed && typeof parsed === "object" ? parsed : {}

  const addr = options.addr ?? "127.0.0.1"
  const port = options.port ?? 7400
  const webServer: Record<string, unknown> = { addr, port }
  if (options.user) webServer.user = options.user
  if (options.password) webServer.password = options.password

  doc.webServer = webServer

  const out =
    format === "toml" ? stringifyToml(doc) : stringifyYaml(doc, { lineWidth: 0 })
  await fs.writeFile(configPath, out, "utf8")

  return {
    enabled: true,
    addr,
    port,
    user: options.user,
    password: options.password,
    baseUrl: `http://${addr}:${port}`,
  }
}
