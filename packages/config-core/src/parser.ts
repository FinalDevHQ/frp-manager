import { parse as parseYaml, stringify as stringifyYaml } from "yaml"
import { parse as parseToml, stringify as stringifyToml } from "smol-toml"
import type { Proxy, ProxyType } from "@frp-manager/shared"
import type { ConfigFormat } from "./format"

/**
 * frpc 配置的顶层结构（v1 仅关心 proxies，其它字段透传保留）
 */
export interface FrpcConfig {
  proxies: Proxy[]
  /** 透传的其它字段（serverAddr / auth / webServer 等），保存时不会丢失 */
  raw: Record<string, unknown>
}

interface RawProxy {
  name?: string
  type?: string
  localIP?: string
  localIp?: string
  localPort?: number
  remotePort?: number
  customDomains?: string[]
}

const SUPPORTED_TYPES: ProxyType[] = ["tcp", "http", "https"]

// ─────────────────────────────────────────────────────────────────────────────
// 统一入口：按 format dispatch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 解析 frpc 配置文本为结构化对象。
 * 容错：proxies 缺失时返回空数组。空文本返回空配置。
 */
export function parseFrpcConfig(text: string, format: ConfigFormat): FrpcConfig {
  if (!text.trim()) return { proxies: [], raw: {} }
  const parsed = format === "toml" ? parseToml(text) : parseYaml(text)
  return normalizeConfig(parsed as Record<string, unknown> | null)
}

/**
 * 将 FrpcConfig 序列化为目标格式的文本，保留 raw 中的其它字段。
 */
export function stringifyFrpcConfig(config: FrpcConfig, format: ConfigFormat): string {
  const output = buildOutputObject(config)
  if (format === "toml") {
    return stringifyToml(output)
  }
  return stringifyYaml(output, { lineWidth: 0 })
}

// ─────────────────────────────────────────────────────────────────────────────
// 向后兼容：保留旧的 YAML-only API（外部调用方可逐步迁移到 *Config 版本）
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated 使用 `parseFrpcConfig(text, "yaml")` 替代 */
export function parseFrpcYaml(yamlText: string): FrpcConfig {
  return parseFrpcConfig(yamlText, "yaml")
}

/** @deprecated 使用 `stringifyFrpcConfig(config, "yaml")` 替代 */
export function stringifyFrpcYaml(config: FrpcConfig): string {
  return stringifyFrpcConfig(config, "yaml")
}

// ─────────────────────────────────────────────────────────────────────────────
// 内部 helper
// ─────────────────────────────────────────────────────────────────────────────

function normalizeConfig(raw: Record<string, unknown> | null): FrpcConfig {
  const safeRaw = raw && typeof raw === "object" ? raw : {}

  const rawProxies = Array.isArray(safeRaw.proxies) ? (safeRaw.proxies as RawProxy[]) : []
  const proxies: Proxy[] = rawProxies
    .filter((p): p is RawProxy => !!p && typeof p === "object")
    .map((p) => normalizeProxy(p))

  const { proxies: _, ...rest } = safeRaw
  return { proxies, raw: rest }
}

function buildOutputObject(config: FrpcConfig): Record<string, unknown> {
  return {
    ...config.raw,
    proxies: config.proxies.map((p) => serializeProxy(p)),
  }
}

function normalizeProxy(p: RawProxy): Proxy {
  const type = (p.type ?? "tcp") as ProxyType
  return {
    name: String(p.name ?? ""),
    type: SUPPORTED_TYPES.includes(type) ? type : "tcp",
    localIp: String(p.localIP ?? p.localIp ?? "127.0.0.1"),
    localPort: Number(p.localPort ?? 0),
    remotePort: p.remotePort != null ? Number(p.remotePort) : undefined,
    customDomains: Array.isArray(p.customDomains) ? p.customDomains.map(String) : undefined,
  }
}

function serializeProxy(p: Proxy): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: p.name,
    type: p.type,
    localIP: p.localIp,
    localPort: p.localPort,
  }
  if (p.type === "tcp" && p.remotePort != null) {
    out.remotePort = p.remotePort
  }
  if ((p.type === "http" || p.type === "https") && p.customDomains?.length) {
    out.customDomains = p.customDomains
  }
  return out
}
