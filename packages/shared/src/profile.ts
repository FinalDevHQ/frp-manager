export type ReloadStrategyType = "none" | "admin-api" | "systemctl" | "docker" | "command"

export interface NoneStrategy {
  type: "none"
}

export interface AdminApiStrategy {
  type: "admin-api"
  /** 例如 http://127.0.0.1:7400 */
  baseUrl: string
  user?: string
  password?: string
}

export interface SystemctlStrategy {
  type: "systemctl"
  serviceName: string
  action: "reload" | "restart"
  /** system: 需要 root 或 sudoers；user: systemctl --user */
  scope: "system" | "user"
}

export interface DockerStrategy {
  type: "docker"
  container: string
  action: "restart" | "kill-hup"
}

export interface CommandStrategy {
  type: "command"
  command: string
}

export type ReloadStrategy =
  | NoneStrategy
  | AdminApiStrategy
  | SystemctlStrategy
  | DockerStrategy
  | CommandStrategy

export interface DeploymentProfile {
  configPath: string
  reload: ReloadStrategy
  updatedAt: number
}

export interface ReloadResult {
  reloaded: boolean
  message: string
  strategyType: ReloadStrategyType
}

export interface ProfileTestResult {
  configPathOk: boolean
  configPathMessage: string
  reloadOk: boolean
  reloadMessage: string
}

export interface ConfigSuggestion {
  path: string
  exists: boolean
}

export interface SystemdServiceSuggestion {
  unit: string
  active: boolean
  scope: "system" | "user"
}

export interface DockerContainerSuggestion {
  id: string
  name: string
  image: string
}

export interface ProfileSuggestions {
  configPaths: ConfigSuggestion[]
  systemdServices: SystemdServiceSuggestion[]
  dockerContainers: DockerContainerSuggestion[]
}
