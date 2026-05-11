import path from "node:path"

/**
 * 路径白名单：所有由用户提交的「文件系统路径」入参（frpc 配置路径、compose 文件等）
 * 必须落在白名单内，否则拒绝。白名单通过环境变量 FRP_MANAGER_ALLOWED_CONFIG_ROOTS
 * 提供，多个根目录用「分号」分隔（同时兼容冒号，但 Windows 路径包含冒号需用分号）。
 *
 * 当未配置时（环境变量为空）保持「允许任意路径」的兼容行为，避免破坏现有部署，
 * 但启动期会打印一条 WARNING 提示。
 */

export class ForbiddenPathError extends Error {
  constructor(public readonly attemptedPath: string) {
    super(`路径不在允许的根目录内: ${attemptedPath}`)
    this.name = "ForbiddenPathError"
  }
}

let cachedRoots: string[] | null = null

export function getAllowedRoots(): string[] {
  if (cachedRoots) return cachedRoots
  const raw = process.env.FRP_MANAGER_ALLOWED_CONFIG_ROOTS ?? ""
  if (!raw.trim()) {
    cachedRoots = []
    return cachedRoots
  }
  // 统一使用分号作为分隔符（避免 Windows 盘符 C:\... 中的冒号被误切）
  cachedRoots = raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => path.resolve(p))
  return cachedRoots
}

export function isPathRestrictionConfigured(): boolean {
  return getAllowedRoots().length > 0
}

/**
 * 校验用户提交的路径：
 *   1) 非空、不含 NUL
 *   2) 解析为绝对路径
 *   3) 若配置了白名单根目录，必须是其中之一，或位于其下
 * 返回规范化后的绝对路径。
 */
export function assertPathAllowed(input: string | undefined | null): string {
  if (typeof input !== "string" || !input.trim()) {
    throw new ForbiddenPathError(String(input))
  }
  if (input.includes("\0")) {
    throw new ForbiddenPathError(input)
  }
  const resolved = path.resolve(input)
  const roots = getAllowedRoots()
  if (roots.length === 0) return resolved
  for (const root of roots) {
    if (resolved === root) return resolved
    if (resolved.startsWith(root + path.sep)) return resolved
  }
  throw new ForbiddenPathError(resolved)
}
