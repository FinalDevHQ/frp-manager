import { promises as fs } from "node:fs"
import path from "node:path"
import type { DeploymentProfile, ReloadStrategy } from "@frp-manager/shared"

/**
 * 管理 runtime/profile.json 的读写。
 * 环境变量 FRPC_CONFIG_PATH / FRPC_RELOAD_TYPE 可覆盖持久化内容。
 */
export class ProfileService {
  constructor(private readonly profilePath: string) {}

  getPath(): string {
    return this.profilePath
  }

  /** 读取 profile；不存在返回 null。环境变量优先合并。 */
  async read(): Promise<DeploymentProfile | null> {
    let stored: DeploymentProfile | null = null
    try {
      const text = await fs.readFile(this.profilePath, "utf8")
      stored = JSON.parse(text) as DeploymentProfile
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
    }

    const envOverride = readEnvProfile()
    if (!stored && !envOverride) return null

    const merged: Partial<DeploymentProfile> = {
      ...(stored ?? {}),
      ...(envOverride ?? {}),
    }

    if (!merged.configPath || !merged.reload) return stored
    return {
      configPath: merged.configPath,
      reload: merged.reload,
      updatedAt: merged.updatedAt ?? Date.now(),
    }
  }

  async write(profile: DeploymentProfile): Promise<DeploymentProfile> {
    const dir = path.dirname(this.profilePath)
    await fs.mkdir(dir, { recursive: true })
    const payload: DeploymentProfile = { ...profile, updatedAt: Date.now() }
    await fs.writeFile(this.profilePath, JSON.stringify(payload, null, 2), "utf8")
    return payload
  }
}

function readEnvProfile(): Partial<DeploymentProfile> | null {
  const configPath = process.env.FRPC_CONFIG_PATH
  const reloadType = process.env.FRPC_RELOAD_TYPE

  if (!configPath && !reloadType) return null

  const partial: Partial<DeploymentProfile> = {}
  if (configPath) partial.configPath = path.resolve(configPath)
  if (reloadType) partial.reload = buildStrategyFromEnv(reloadType)
  return partial
}

function buildStrategyFromEnv(type: string): ReloadStrategy {
  switch (type) {
    case "admin-api":
      return {
        type: "admin-api",
        baseUrl: process.env.FRPC_ADMIN_BASE_URL ?? "http://127.0.0.1:7400",
        user: process.env.FRPC_ADMIN_USER,
        password: process.env.FRPC_ADMIN_PASSWORD,
      }
    case "systemctl":
      return {
        type: "systemctl",
        serviceName: process.env.FRPC_SYSTEMCTL_SERVICE ?? "frpc",
        action: (process.env.FRPC_SYSTEMCTL_ACTION as "reload" | "restart") ?? "reload",
        scope: (process.env.FRPC_SYSTEMCTL_SCOPE as "system" | "user") ?? "system",
      }
    case "docker":
      return {
        type: "docker",
        container: process.env.FRPC_DOCKER_CONTAINER ?? "frpc",
        action: (process.env.FRPC_DOCKER_ACTION as "restart" | "kill-hup") ?? "restart",
      }
    case "command":
      return {
        type: "command",
        command: process.env.FRPC_RELOAD_COMMAND ?? "",
      }
    default:
      return { type: "none" }
  }
}
