import type { Proxy } from "./proxy"

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface ConfigPreview {
  /** 当前已保存的 YAML */
  current: string
  /** 基于当前 proxies 生成的 YAML */
  next: string
}

export interface SystemStatus {
  /** frpc 进程状态，v1 占位 */
  running: boolean
  /** 配置文件路径 */
  configPath: string
  /** 上次保存时间 */
  lastSavedAt?: number
}

export type GetProxiesResponse = ApiResponse<Proxy[]>
export type GetProxyResponse = ApiResponse<Proxy>
export type MutateProxyResponse = ApiResponse<Proxy>
export type DeleteProxyResponse = ApiResponse<{ name: string }>
export type ConfigPreviewResponse = ApiResponse<ConfigPreview>
export type ConfigYamlResponse = ApiResponse<{ yaml: string }>
export type ConfigSaveResponse = ApiResponse<{ savedAt: number; backupPath: string }>
export type SystemReloadResponse = ApiResponse<{ reloaded: boolean; message: string }>
export type SystemStatusResponse = ApiResponse<SystemStatus>
