import { promises as fs } from "node:fs"
import path from "node:path"

/**
 * 将 configPath 备份到同目录的 <name>.bak.<timestamp>，返回备份文件路径。
 * 如果原文件不存在则返回 null。
 */
export async function backupFile(configPath: string): Promise<string | null> {
  try {
    await fs.access(configPath)
  } catch {
    return null
  }

  const dir = path.dirname(configPath)
  const base = path.basename(configPath)
  const ts = formatTimestamp(new Date())
  const backupPath = path.join(dir, `${base}.bak.${ts}`)

  await fs.copyFile(configPath, backupPath)
  return backupPath
}

function formatTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "-" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  )
}
