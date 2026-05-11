import axios, { AxiosError } from "axios"
import type {
  ApiResponse,
  ConfigPreview,
  Proxy,
  SystemStatus,
} from "@frp-manager/shared"

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
      throw new Error(message ?? err.message)
    }
    throw err
  }
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
  reload: () =>
    unwrap<{ reloaded: boolean; message: string }>(api.post("/system/reload")),
}
