import path from "node:path"
import { ConfigService } from "@frp-manager/config-core"

/**
 * 应用级上下文：保存 ConfigService 单例和运行时状态
 */
export interface AppContext {
  configService: ConfigService
  lastSavedAt?: number
}

export function createContext(): AppContext {
  const configPath = process.env.FRPC_CONFIG_PATH
    ? path.resolve(process.env.FRPC_CONFIG_PATH)
    : path.resolve(process.cwd(), "../../config/frpc.yml")

  return {
    configService: new ConfigService(configPath),
  }
}
