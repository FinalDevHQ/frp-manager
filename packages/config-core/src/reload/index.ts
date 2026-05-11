import type { ReloadResult, ReloadStrategy } from "@frp-manager/shared"
import { reloadNone } from "./none"
import { reloadSystemctl } from "./systemctl"
import { reloadAdminApi } from "./admin-api"
import { reloadDocker } from "./docker"
import { reloadDockerCompose } from "./docker-compose"
import { reloadCommand } from "./command"

export async function executeReload(strategy: ReloadStrategy): Promise<ReloadResult> {
  switch (strategy.type) {
    case "none":
      return reloadNone()
    case "systemctl":
      return reloadSystemctl(strategy)
    case "admin-api":
      return reloadAdminApi(strategy)
    case "docker":
      return reloadDocker(strategy)
    case "docker-compose":
      return reloadDockerCompose(strategy)
    case "command":
      return reloadCommand(strategy)
  }
}
