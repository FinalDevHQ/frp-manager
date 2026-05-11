import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import type {
  ConfigSuggestion,
  DockerContainerSuggestion,
  ProfileSuggestions,
  SystemdServiceSuggestion,
} from "@frp-manager/shared"
import { runCommand } from "./reload/systemctl"

const COMMON_CONFIG_PATHS = [
  "/etc/frp/frpc.yml",
  "/etc/frp/frpc.toml",
  "/etc/frpc/frpc.yml",
  "/usr/local/etc/frp/frpc.yml",
  "/usr/local/etc/frp/frpc.toml",
  "/opt/frp/frpc.yml",
  "/opt/frp/frpc.toml",
]

export async function discover(): Promise<ProfileSuggestions> {
  const [configPaths, systemdServices, dockerContainers] = await Promise.all([
    discoverConfigPaths(),
    discoverSystemdServices(),
    discoverDockerContainers(),
  ])
  return { configPaths, systemdServices, dockerContainers }
}

export async function discoverConfigPaths(): Promise<ConfigSuggestion[]> {
  const home = os.homedir()
  const candidates = [
    ...COMMON_CONFIG_PATHS,
    path.join(home, ".frp", "frpc.yml"),
    path.join(home, ".frp", "frpc.toml"),
    path.join(home, ".config", "frp", "frpc.yml"),
  ]

  const results = await Promise.all(
    candidates.map(async (p) => ({
      path: p,
      exists: await fileExists(p),
    })),
  )
  // 存在的优先；全都不存在则至少返回候选便于展示
  const exists = results.filter((r) => r.exists)
  return exists.length > 0 ? exists : results.slice(0, 4)
}

export async function discoverSystemdServices(): Promise<SystemdServiceSuggestion[]> {
  if (process.platform !== "linux") return []
  const suggestions: SystemdServiceSuggestion[] = []

  for (const scope of ["system", "user"] as const) {
    const args: string[] = []
    if (scope === "user") args.push("--user")
    args.push("list-units", "--all", "--type=service", "--no-legend", "--no-pager", "--plain")

    try {
      const result = await runCommand("systemctl", args, 3_000)
      if (result.code !== 0) continue
      for (const line of result.stdout.split("\n")) {
        const parts = line.trim().split(/\s+/)
        const unit = parts[0]
        if (!unit || !/frpc?\.service$/.test(unit)) continue
        const active = line.includes(" active ")
        suggestions.push({ unit: unit.replace(/\.service$/, ""), active, scope })
      }
    } catch {
      // systemctl 不存在或失败，忽略
    }
  }
  return suggestions
}

export async function discoverDockerContainers(): Promise<DockerContainerSuggestion[]> {
  try {
    const result = await runCommand(
      "docker",
      ["ps", "--format", "{{.ID}}|{{.Names}}|{{.Image}}"],
      3_000,
    )
    if (result.code !== 0) return []
    return result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [id, name, image] = line.split("|")
        return { id, name, image }
      })
      .filter((c) => /frpc?/i.test(c.image) || /frpc?/i.test(c.name))
  } catch {
    return []
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p)
    return stat.isFile()
  } catch {
    return false
  }
}
