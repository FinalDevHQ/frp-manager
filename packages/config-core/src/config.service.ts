import { promises as fs } from "node:fs"
import path from "node:path"
import type { Proxy } from "@frp-manager/shared"
import { parseFrpcConfig, stringifyFrpcConfig, type FrpcConfig } from "./parser"
import { detectFormat, type ConfigFormat } from "./format"
import { assertValidProxies } from "./validator"
import { backupFile } from "./backup"

/**
 * 文件级 ConfigService：包装 parser + backup，管理 frpc 配置文件的读/写。
 * 单例方式使用，由 server 传入 configPath。
 * 文件格式按后缀自动判定（.toml → TOML，其它 → YAML），并在实例生命周期内固定。
 */
export class ConfigService {
  private readonly format: ConfigFormat

  constructor(private readonly configPath: string) {
    this.format = detectFormat(configPath)
  }

  getConfigPath(): string {
    return this.configPath
  }

  /** 当前实例使用的序列化格式（yaml / toml） */
  getFormat(): ConfigFormat {
    return this.format
  }

  /** 读取并解析当前配置；文件不存在则返回空配置 */
  async read(): Promise<FrpcConfig> {
    try {
      const text = await fs.readFile(this.configPath, "utf8")
      return parseFrpcConfig(text, this.format)
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { proxies: [], raw: {} }
      }
      throw err
    }
  }

  /** 读取原始文本；文件不存在则返回空字符串 */
  async readRaw(): Promise<string> {
    try {
      return await fs.readFile(this.configPath, "utf8")
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return ""
      }
      throw err
    }
  }

  /** 基于一组 proxies 生成目标格式的文本（不写入） */
  async preview(proxies: Proxy[]): Promise<string> {
    assertValidProxies(proxies)
    const current = await this.read()
    const next: FrpcConfig = { ...current, proxies }
    return stringifyFrpcConfig(next, this.format)
  }

  /**
   * 写入新的 proxies，自动备份原文件
   * @returns 写入时间戳 + 备份路径（首次写入时为 null）
   */
  async save(proxies: Proxy[]): Promise<{ savedAt: number; backupPath: string | null }> {
    assertValidProxies(proxies)

    const dir = path.dirname(this.configPath)
    await fs.mkdir(dir, { recursive: true })

    const backupPath = await backupFile(this.configPath)

    const current = await this.read()
    const next: FrpcConfig = { ...current, proxies }
    const text = stringifyFrpcConfig(next, this.format)

    await fs.writeFile(this.configPath, text, "utf8")
    return { savedAt: Date.now(), backupPath }
  }
}
