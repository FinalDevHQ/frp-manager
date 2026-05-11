import { api } from "./api"
import type { ApiResponse } from "@frp-manager/shared"

const TOKEN_KEY = "frp-manager-token"
export const AUTH_EXPIRED_EVENT = "frp-manager:auth-expired"

export const authStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      // ignore
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      // ignore
    }
  },
}

/** 注册 axios 拦截器：请求自动加 Authorization；401 时清 token 并广播事件 */
export function installAuthInterceptors() {
  api.interceptors.request.use((config) => {
    const token = authStorage.get()
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`)
    }
    return config
  })

  api.interceptors.response.use(
    (res) => res,
    (err) => {
      const status = err?.response?.status
      const url: string = err?.config?.url ?? ""
      // /auth/login 自身的 401 由登录页处理，不广播
      if (status === 401 && !url.includes("/auth/login")) {
        authStorage.clear()
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT))
      }
      return Promise.reject(err)
    },
  )
}

export interface AuthStatus {
  authenticated: boolean
  passwordIsDefault: boolean
}

export const authApi = {
  async login(password: string): Promise<{ token: string; expiresAt: number }> {
    const res = await api.post<ApiResponse<{ token: string; expiresAt: number }>>(
      "/auth/login",
      { password },
    )
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "登录失败")
    }
    return res.data.data
  },
  async status(): Promise<AuthStatus> {
    try {
      const res = await api.get<ApiResponse<AuthStatus>>("/auth/status")
      const d = res.data.data
      return {
        authenticated: !!d?.authenticated,
        passwordIsDefault: !!d?.passwordIsDefault,
      }
    } catch {
      return { authenticated: false, passwordIsDefault: false }
    }
  },
  async changePassword(payload: {
    oldPassword: string
    newPassword: string
    rotateSecret?: boolean
  }): Promise<{ rotated: boolean; token: string; expiresAt: number }> {
    const res = await api.post<
      ApiResponse<{ rotated: boolean; token: string; expiresAt: number }>
    >("/auth/change-password", payload)
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "修改密码失败")
    }
    return res.data.data
  },
}
