export type ProxyType = "tcp" | "http" | "https"

export const PROXY_TYPES: ProxyType[] = ["tcp", "http", "https"]

export interface Proxy {
  name: string
  type: ProxyType
  localIp: string
  localPort: number
  /** tcp 类型必填 */
  remotePort?: number
  /** http/https 类型必填 */
  customDomains?: string[]
}

export type ProxyInput = Proxy
