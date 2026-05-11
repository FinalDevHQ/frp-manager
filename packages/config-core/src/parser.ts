import { parse, stringify } from "yaml"
import type { Proxy, ProxyType } from "@frp-manager/shared"

/**
 * frpc.yml 的顶层结构（v1 仅关心 proxies，其它字段透传保留）
 */
export interface FrpcConfig {
  proxies: Proxy[]
  /** 透传的其它字段（serverAddr / auth 等），保存时不会丢失 */
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

/**
 * 解析 frpc.yml 文本为结构化配置
 * 容错：proxies 缺失时返回空数组
 */
export function parseFrpcYaml(yamlText: string): FrpcConfig {
  const raw = (yamlText.trim() ? parse(yamlText) : {}) as Record<string, unknown> | null
  const safeRaw = raw && typeof raw === "object" ? raw : {}

  const rawProxies = Array.isArray(safeRaw.proxies) ? (safeRaw.proxies as RawProxy[]) : []
  const proxies: Proxy[] = rawProxies
    .filter((p): p is RawProxy => !!p && typeof p === "object")
    .map((p) => normalizeProxy(p))

  const { proxies: _, ...rest } = safeRaw
  return { proxies, raw: rest }
}

/**
 * 将 FrpcConfig 序列化为 YAML 文本
 * 保留 raw 中的其它字段
 */
export function stringifyFrpcYaml(config: FrpcConfig): string {
  const output = {
    ...config.raw,
    proxies: config.proxies.map((p) => serializeProxy(p)),
  }
  return stringify(output, { lineWidth: 0 })
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
