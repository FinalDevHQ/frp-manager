import type { DockerStrategy, ReloadResult } from "@frp-manager/shared"
import { runCommand } from "./systemctl"

const TIMEOUT_MS = 15_000

export async function reloadDocker(strategy: DockerStrategy): Promise<ReloadResult> {
  const args: string[] =
    strategy.action === "restart"
      ? ["restart", strategy.container]
      : ["kill", "-s", "HUP", strategy.container]

  try {
    const result = await runCommand("docker", args, TIMEOUT_MS)
    if (result.code === 0) {
      return {
        reloaded: true,
        message: `docker ${args.join(" ")} 执行成功`,
        strategyType: "docker",
      }
    }
    return {
      reloaded: false,
      message: `docker 退出码 ${result.code}: ${result.stderr || result.stdout}`,
      strategyType: "docker",
    }
  } catch (err: unknown) {
    return {
      reloaded: false,
      message: `执行 docker 失败: ${(err as Error).message}`,
      strategyType: "docker",
    }
  }
}
