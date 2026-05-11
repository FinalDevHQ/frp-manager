import { exec } from "node:child_process"
import { promisify } from "node:util"
import type { CommandStrategy, ReloadResult } from "@frp-manager/shared"

const execAsync = promisify(exec)
const TIMEOUT_MS = 30_000

/**
 * 执行用户自定义 shell 命令。
 * 注意：此策略本质是 RCE，务必只允许本机访问使用。
 */
export async function reloadCommand(strategy: CommandStrategy): Promise<ReloadResult> {
  if (!strategy.command?.trim()) {
    return { reloaded: false, message: "命令为空", strategyType: "command" }
  }

  try {
    const { stdout, stderr } = await execAsync(strategy.command, {
      timeout: TIMEOUT_MS,
      windowsHide: true,
    })
    const out = (stdout + stderr).trim().slice(0, 500)
    return {
      reloaded: true,
      message: out || "命令执行成功（无输出）",
      strategyType: "command",
    }
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string }
    const out = ((e.stdout ?? "") + (e.stderr ?? "") || e.message).trim().slice(0, 500)
    return {
      reloaded: false,
      message: `命令执行失败: ${out}`,
      strategyType: "command",
    }
  }
}
