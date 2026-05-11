import { promises as fs } from "node:fs"
import path from "node:path"
import type { Proxy } from "@frp-manager/shared"
import { parseFrpcYaml, stringifyFrpcYaml, type FrpcConfig } from "./parser"
import { assertValidProxies } from "./validator"
import { backupFile } from "./backup"

/**
 * 文件级 ConfigService：包装 parser + backup，管理 frpc.yml 的读/写。
 * 单例方式使用，由 server 传入 configPath。
 */
export class ConfigService {
  constructor(private readonly configPath: string) {}

  getConfigPath(): string {
    return this.configPath
  }

  /** 读取并解析当前 frpc.yml；文件不存在则返回空配置 */
  async read(): Promise<FrpcConfig> {
    try {
      const text = await fs.readFile(this.configPath, "utf8")
      return parseFrpcYaml(text)
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { proxies: [], raw: {} }
      }
      throw err
    }
  }

  /** 读取原始 YAML 文本；文件不存在则返回空字符串 */
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

  /** 基于一组 proxies 生成 YAML 文本（不写入） */
  async preview(proxies: Proxy[]): Promise<string> {
    assertValidProxies(proxies)
    const current = await this.read()
    const next: FrpcConfig = { ...current, proxies }
    return stringifyFrpcYaml(next)
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
    const yaml = stringifyFrpcYaml(next)

    await fs.writeFile(this.configPath, yaml, "utf8")
    return { savedAt: Date.now(), backupPath }
  }
}
