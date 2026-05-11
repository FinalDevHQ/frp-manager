import type { Proxy } from "@frp-manager/shared"

export interface ValidationError {
  field: string
  message: string
}

export class ValidationException extends Error {
  constructor(public errors: ValidationError[]) {
    super(errors.map((e) => `${e.field}: ${e.message}`).join("; "))
    this.name = "ValidationException"
  }
}

const NAME_PATTERN = /^[a-zA-Z0-9_-]+$/
const PORT_MIN = 1
const PORT_MAX = 65535

/**
 * 校验单个 proxy 自身字段是否合法
 */
export function validateProxy(proxy: Proxy): ValidationError[] {
  const errors: ValidationError[] = []

  if (!proxy.name?.trim()) {
    errors.push({ field: "name", message: "名称不能为空" })
  } else if (!NAME_PATTERN.test(proxy.name)) {
    errors.push({ field: "name", message: "名称只能包含字母、数字、下划线、横线" })
  }

  if (!proxy.localIp?.trim()) {
    errors.push({ field: "localIp", message: "本地 IP 不能为空" })
  }

  if (!isValidPort(proxy.localPort)) {
    errors.push({ field: "localPort", message: `本地端口必须在 ${PORT_MIN}-${PORT_MAX} 之间` })
  }

  if (proxy.type === "tcp") {
    if (proxy.remotePort == null) {
      errors.push({ field: "remotePort", message: "tcp 类型必须填写远程端口" })
    } else if (!isValidPort(proxy.remotePort)) {
      errors.push({ field: "remotePort", message: `远程端口必须在 ${PORT_MIN}-${PORT_MAX} 之间` })
    }
  }

  if (proxy.type === "http" || proxy.type === "https") {
    if (!proxy.customDomains?.length) {
      errors.push({ field: "customDomains", message: `${proxy.type} 类型必须至少配置一个自定义域名` })
    }
  }

  return errors
}

/**
 * 校验 proxy 列表整体一致性（重名、端口冲突等）
 */
export function validateProxies(proxies: Proxy[]): ValidationError[] {
  const errors: ValidationError[] = []

  proxies.forEach((p, idx) => {
    validateProxy(p).forEach((e) => {
      errors.push({ field: `proxies[${idx}].${e.field}`, message: e.message })
    })
  })

  // 名称重复
  const nameMap = new Map<string, number>()
  proxies.forEach((p, idx) => {
    if (!p.name) return
    if (nameMap.has(p.name)) {
      errors.push({
        field: `proxies[${idx}].name`,
        message: `名称 "${p.name}" 与索引 ${nameMap.get(p.name)} 的 proxy 重复`,
      })
    } else {
      nameMap.set(p.name, idx)
    }
  })

  // 远程端口冲突（仅 tcp）
  const portMap = new Map<number, number>()
  proxies.forEach((p, idx) => {
    if (p.type !== "tcp" || p.remotePort == null) return
    if (portMap.has(p.remotePort)) {
      errors.push({
        field: `proxies[${idx}].remotePort`,
        message: `远程端口 ${p.remotePort} 与索引 ${portMap.get(p.remotePort)} 的 proxy 冲突`,
      })
    } else {
      portMap.set(p.remotePort, idx)
    }
  })

  return errors
}

export function assertValidProxies(proxies: Proxy[]): void {
  const errors = validateProxies(proxies)
  if (errors.length > 0) {
    throw new ValidationException(errors)
  }
}

function isValidPort(port: number | undefined): boolean {
  return typeof port === "number" && Number.isInteger(port) && port >= PORT_MIN && port <= PORT_MAX
}
