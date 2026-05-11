import axios, { AxiosError } from "axios"
import type {
  ApiResponse,
  ConfigPreview,
  DeploymentProfile,
  ProfileSuggestions,
  ProfileTestResult,
  Proxy,
  ReloadResult,
  SystemStatus,
} from "@frp-manager/shared"

export class ProfileNotConfiguredError extends Error {
  constructor() {
    super("PROFILE_NOT_CONFIGURED")
    this.name = "ProfileNotConfiguredError"
  }
}

export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
})

/** 解包后端 { success, data, error } 信封；失败抛出 Error */
async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  try {
    const res = await promise
    if (!res.data.success || res.data.data === undefined) {
      throw new Error(res.data.error ?? "Unknown error")
    }
    return res.data.data
  } catch (err) {
    if (err instanceof AxiosError) {
      const message = (err.response?.data as ApiResponse<unknown> | undefined)?.error
      if (err.response?.status === 412 && message === "PROFILE_NOT_CONFIGURED") {
        throw new ProfileNotConfiguredError()
      }
      // 保留底层 AxiosError 为 cause，便于调用方拿到 status/headers 做更细处理
      throw new Error(message ?? err.message, { cause: err })
    }
    throw err
  }
}

/** 允许 null 的 unwrap，用于 profile 接口（未配置返回 null） */
async function unwrapNullable<T>(promise: Promise<{ data: ApiResponse<T | null> }>): Promise<T | null> {
  const res = await promise
  if (!res.data.success) throw new Error(res.data.error ?? "Unknown error")
  return res.data.data ?? null
}

export const proxyApi = {
  list: () => unwrap<Proxy[]>(api.get("/proxies")),
  get: (name: string) => unwrap<Proxy>(api.get(`/proxies/${encodeURIComponent(name)}`)),
  create: (proxy: Proxy) => unwrap<Proxy>(api.post("/proxies", proxy)),
  update: (name: string, proxy: Proxy) =>
    unwrap<Proxy>(api.put(`/proxies/${encodeURIComponent(name)}`, proxy)),
  remove: (name: string) =>
    unwrap<{ name: string }>(api.delete(`/proxies/${encodeURIComponent(name)}`)),
}

export const configApi = {
  preview: (proxies?: Proxy[]) =>
    unwrap<ConfigPreview & { diff: { op: string; text: string }[] }>(
      api.post("/config/preview", { proxies }),
    ),
  yaml: () => unwrap<{ yaml: string }>(api.get("/config/yaml")),
  save: (proxies: Proxy[]) =>
    unwrap<{ savedAt: number; backupPath: string }>(api.post("/config/save", { proxies })),
}

export const systemApi = {
  status: () => unwrap<SystemStatus>(api.get("/system/status")),
  reload: () => unwrap<ReloadResult>(api.post("/system/reload")),
}

export interface WebServerInfo {
  enabled: boolean
  addr?: string
  port?: number
  user?: string
  password?: string
  baseUrl?: string
}

export const profileApi = {
  get: () => unwrapNullable<DeploymentProfile>(api.get("/profile")),
  save: (profile: DeploymentProfile, options?: { confirmCommand?: boolean }) =>
    unwrap<DeploymentProfile>(
      api.put("/profile", { ...profile, confirmCommand: options?.confirmCommand }),
    ),
  test: (profile: DeploymentProfile) =>
    unwrap<ProfileTestResult>(api.post("/profile/test", profile)),
  inspectAdmin: (configPath: string) =>
    unwrap<WebServerInfo>(api.post("/profile/inspect-admin", { configPath })),
  enableAdmin: (payload: {
    configPath: string
    addr?: string
    port?: number
    user?: string
    password?: string
  }) => unwrap<WebServerInfo>(api.post("/profile/enable-admin", payload)),
  suggestions: () => unwrap<ProfileSuggestions>(api.get("/profile/suggestions")),
}
