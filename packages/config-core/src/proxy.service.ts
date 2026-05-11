import type { Proxy, ProxyInput } from "@frp-manager/shared"
import type { FrpcConfig } from "./parser"
import { assertValidProxies } from "./validator"

/**
 * 纯函数 CRUD：所有操作返回新的 FrpcConfig，不修改入参
 */

export function listProxies(config: FrpcConfig): Proxy[] {
  return [...config.proxies]
}

export function findProxy(config: FrpcConfig, name: string): Proxy | undefined {
  return config.proxies.find((p) => p.name === name)
}

export function addProxy(config: FrpcConfig, input: ProxyInput): FrpcConfig {
  if (config.proxies.some((p) => p.name === input.name)) {
    throw new Error(`Proxy "${input.name}" 已存在`)
  }
  const next: FrpcConfig = {
    ...config,
    proxies: [...config.proxies, input],
  }
  assertValidProxies(next.proxies)
  return next
}

export function updateProxy(config: FrpcConfig, name: string, input: ProxyInput): FrpcConfig {
  const idx = config.proxies.findIndex((p) => p.name === name)
  if (idx === -1) {
    throw new Error(`Proxy "${name}" 不存在`)
  }
  // 如果改名，新名字不能与其它 proxy 冲突
  if (input.name !== name && config.proxies.some((p) => p.name === input.name)) {
    throw new Error(`Proxy "${input.name}" 已存在`)
  }
  const proxies = [...config.proxies]
  proxies[idx] = input
  const next: FrpcConfig = { ...config, proxies }
  assertValidProxies(next.proxies)
  return next
}

export function deleteProxy(config: FrpcConfig, name: string): FrpcConfig {
  const idx = config.proxies.findIndex((p) => p.name === name)
  if (idx === -1) {
    throw new Error(`Proxy "${name}" 不存在`)
  }
  const proxies = config.proxies.filter((p) => p.name !== name)
  return { ...config, proxies }
}
