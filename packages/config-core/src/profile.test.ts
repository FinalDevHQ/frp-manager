import { promises as fs } from "node:fs"
import type {
  DeploymentProfile,
  ProfileTestResult,
  ReloadStrategy,
} from "@frp-manager/shared"

/**
 * 测试一个 profile 是否可用：
 * - configPath 是否可读
 * - reload 策略是否具备基本执行条件（例如 systemctl 是否存在）
 * 不会真的触发 reload。
 */
export async function testProfile(profile: DeploymentProfile): Promise<ProfileTestResult> {
  const configTest = await testConfigPath(profile.configPath)
  const reloadTest = await testReloadStrategy(profile.reload)
  return {
    configPathOk: configTest.ok,
    configPathMessage: configTest.message,
    reloadOk: reloadTest.ok,
    reloadMessage: reloadTest.message,
  }
}

async function testConfigPath(p: string): Promise<{ ok: boolean; message: string }> {
  if (!p) return { ok: false, message: "路径不能为空" }
  try {
    const stat = await fs.stat(p)
    if (!stat.isFile()) return { ok: false, message: "路径不是一个文件" }
    await fs.access(p, fs.constants.R_OK | fs.constants.W_OK)
    return { ok: true, message: `可读写（${formatSize(stat.size)}）` }
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException
    if (e.code === "ENOENT") return { ok: false, message: "文件不存在（保存时会自动创建）" }
    if (e.code === "EACCES") return { ok: false, message: "无读写权限" }
    return { ok: false, message: e.message }
  }
}

async function testReloadStrategy(
  r: ReloadStrategy,
): Promise<{ ok: boolean; message: string }> {
  switch (r.type) {
    case "none":
      return { ok: true, message: "仅保存文件，无需 reload" }
    case "systemctl":
      if (!r.serviceName) return { ok: false, message: "服务名不能为空" }
      return { ok: true, message: `将执行 systemctl ${r.scope === "user" ? "--user " : ""}${r.action} ${r.serviceName}` }
    case "admin-api":
      if (!r.baseUrl) return { ok: false, message: "Admin API 地址不能为空" }
      return { ok: true, message: `将调用 POST ${r.baseUrl.replace(/\/$/, "")}/api/reload` }
    case "docker":
      if (!r.container) return { ok: false, message: "容器名不能为空" }
      return { ok: true, message: `将执行 docker ${r.action === "restart" ? "restart" : "kill -s HUP"} ${r.container}` }
    case "command":
      if (!r.command?.trim()) return { ok: false, message: "命令不能为空" }
      return { ok: true, message: `将执行: ${r.command}` }
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
