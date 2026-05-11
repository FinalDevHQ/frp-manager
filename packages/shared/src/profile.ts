export type ReloadStrategyType =
  | "none"
  | "admin-api"
  | "systemctl"
  | "docker"
  | "docker-compose"
  | "command"

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

export interface DockerComposeStrategy {
  type: "docker-compose"
  /** docker-compose.yml 绝对路径；空则使用 workingDir 下默认文件 */
  composeFile?: string
  /** compose 命令执行目录；不填则取 composeFile 所在目录或 cwd */
  workingDir?: string
  /** 要操作的 service 名 */
  service: string
  /**
   * - restart: docker compose restart <svc>
   * - up:      docker compose up -d <svc>
   * - kill-hup: docker compose kill -s HUP <svc>
   */
  action: "restart" | "up" | "kill-hup"
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
  | DockerComposeStrategy
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

export interface DockerComposeSuggestion {
  /** compose 文件绝对路径 */
  composeFile: string
  /** 文件所在目录，建议作为 workingDir */
  workingDir: string
  /** 文件中疑似 frpc 的 service 名 */
  services: string[]
}

export interface ProfileSuggestions {
  configPaths: ConfigSuggestion[]
  systemdServices: SystemdServiceSuggestion[]
  dockerContainers: DockerContainerSuggestion[]
  dockerCompose: DockerComposeSuggestion[]
}
