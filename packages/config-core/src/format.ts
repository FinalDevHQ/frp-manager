import path from "node:path"

/**
 * frpc 配置文件支持的两种序列化格式。
 * frp 官方在 v0.52+ 推荐 TOML，但仍兼容 YAML/JSON。本项目 v1 支持 yaml / toml。
 */
export type ConfigFormat = "yaml" | "toml"

/**
 * 根据文件路径的后缀推断配置格式。
 *
 * - `.toml`                → `toml`
 * - `.yml` / `.yaml` / 其它 → `yaml`（向后兼容默认值）
 */
export function detectFormat(filePath: string): ConfigFormat {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === ".toml") return "toml"
  return "yaml"
}
