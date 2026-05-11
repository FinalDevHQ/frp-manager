import path from "node:path"
import type { DeploymentProfile, ReloadResult } from "@frp-manager/shared"
import { ConfigService, ProfileService } from "@frp-manager/config-core"
import type { AuthService } from "./auth"

/**
 * 应用级上下文。ConfigService 根据当前 profile 按需创建。
 * profile 缺失时大部分接口应返回 PROFILE_NOT_CONFIGURED。
 */
export interface AppContext {
  profileService: ProfileService
  authService: AuthService
  /** 根据 profile.configPath 获取 ConfigService；未配置时抛错 */
  requireConfigService: () => Promise<ConfigService>
  /** 获取当前 profile 快照 */
  getProfile: () => Promise<DeploymentProfile | null>
  lastSavedAt?: number
  lastReload?: ReloadResult & { at: number }
}

export function createContext(authService: AuthService): AppContext {
  const profilePath = process.env.FRP_MANAGER_PROFILE_PATH
    ? path.resolve(process.env.FRP_MANAGER_PROFILE_PATH)
    : path.resolve(process.cwd(), "../../runtime/profile.json")

  const profileService = new ProfileService(profilePath)

  let cached: { path: string; service: ConfigService } | null = null

  const ctx: AppContext = {
    profileService,
    authService,
    async getProfile() {
      return profileService.read()
    },
    async requireConfigService() {
      const profile = await profileService.read()
      if (!profile?.configPath) {
        const err = new Error("PROFILE_NOT_CONFIGURED")
        err.name = "ProfileNotConfiguredError"
        throw err
      }
      if (!cached || cached.path !== profile.configPath) {
        cached = { path: profile.configPath, service: new ConfigService(profile.configPath) }
      }
      return cached.service
    },
  }
  return ctx
}
