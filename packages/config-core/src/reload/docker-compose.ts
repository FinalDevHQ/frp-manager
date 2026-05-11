import path from "node:path"
import type { DockerComposeStrategy, ReloadResult } from "@frp-manager/shared"
import { runCommandIn } from "./systemctl"

const TIMEOUT_MS = 30_000

/**
 * 通过 docker compose 子命令操作 frpc。
 * 优先使用 `docker compose`（v2 内置插件），失败时回退到 `docker-compose`（v1 二进制）。
 */
export async function reloadDockerCompose(strategy: DockerComposeStrategy): Promise<ReloadResult> {
  const composeArgs: string[] = []
  if (strategy.composeFile) composeArgs.push("-f", strategy.composeFile)

  switch (strategy.action) {
    case "restart":
      composeArgs.push("restart", strategy.service)
      break
    case "up":
      composeArgs.push("up", "-d", strategy.service)
      break
    case "kill-hup":
      composeArgs.push("kill", "-s", "HUP", strategy.service)
      break
  }

  const cwd =
    strategy.workingDir ||
    (strategy.composeFile ? path.dirname(strategy.composeFile) : undefined)

  // 先试 docker compose（v2）
  const v2 = await tryRun(["docker", "compose", ...composeArgs], cwd)
  if (v2.code === 0) {
    return {
      reloaded: true,
      message: `docker compose ${composeArgs.join(" ")} 执行成功`,
      strategyType: "docker-compose",
    }
  }

  // v2 失败且看起来是「子命令不存在」时，回退到 v1
  const looksMissingV2 = /is not a docker command|unknown command/i.test(v2.stderr)
  if (looksMissingV2) {
    const v1 = await tryRun(["docker-compose", ...composeArgs], cwd)
    if (v1.code === 0) {
      return {
        reloaded: true,
        message: `docker-compose ${composeArgs.join(" ")} 执行成功`,
        strategyType: "docker-compose",
      }
    }
    return {
      reloaded: false,
      message: `docker-compose 退出码 ${v1.code}: ${v1.stderr || v1.stdout}`,
      strategyType: "docker-compose",
    }
  }

  return {
    reloaded: false,
    message: `docker compose 退出码 ${v2.code}: ${v2.stderr || v2.stdout}`,
    strategyType: "docker-compose",
  }
}

async function tryRun(
  argv: string[],
  cwd: string | undefined,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const [cmd, ...rest] = argv
  try {
    return await runCommandIn(cmd, rest, TIMEOUT_MS, cwd)
  } catch (err: unknown) {
    return { code: -1, stdout: "", stderr: (err as Error).message }
  }
}
