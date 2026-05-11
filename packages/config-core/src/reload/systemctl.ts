import { spawn } from "node:child_process"
import type { ReloadResult, SystemctlStrategy } from "@frp-manager/shared"

const TIMEOUT_MS = 10_000

export async function reloadSystemctl(strategy: SystemctlStrategy): Promise<ReloadResult> {
  const args: string[] = []
  if (strategy.scope === "user") args.push("--user")
  args.push(strategy.action, strategy.serviceName)

  try {
    const result = await runCommand("systemctl", args, TIMEOUT_MS)
    if (result.code === 0) {
      return {
        reloaded: true,
        message: `systemctl ${args.join(" ")} 执行成功`,
        strategyType: "systemctl",
      }
    }
    return {
      reloaded: false,
      message: `systemctl 退出码 ${result.code}: ${result.stderr || result.stdout}`,
      strategyType: "systemctl",
    }
  } catch (err: unknown) {
    return {
      reloaded: false,
      message: `执行 systemctl 失败: ${(err as Error).message}`,
      strategyType: "systemctl",
    }
  }
}

interface CommandResult {
  code: number
  stdout: string
  stderr: string
}

export function runCommand(cmd: string, args: string[], timeoutMs: number): Promise<CommandResult> {
  return runCommandIn(cmd, args, timeoutMs, undefined)
}

export function runCommandIn(
  cmd: string,
  args: string[],
  timeoutMs: number,
  cwd: string | undefined,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true, cwd })
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`命令超时（${timeoutMs}ms）`))
    }, timeoutMs)

    child.stdout.on("data", (d) => (stdout += d.toString()))
    child.stderr.on("data", (d) => (stderr += d.toString()))
    child.on("error", (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? -1, stdout, stderr })
    })
  })
}
