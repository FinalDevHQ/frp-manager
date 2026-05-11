import { promises as fs } from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { promisify } from "node:util"

/**
 * 持久化在 config/auth.json：
 *   - version            数据格式版本，便于迁移
 *   - passwordHash       scrypt(password, salt) 派生 hash；格式 `scrypt:<saltHex>:<hashHex>`
 *   - passwordIsDefault  当前是否仍为安装期默认密码（true → 应在 UI 上提醒用户改密）
 *   - secret             HMAC token 签名 + AES 字段加密的主密钥（hex；64 chars）
 *   - tokenTtlHours      token 有效期，默认 168（7 天）
 *
 * 兼容旧格式 v1：{ password, secret, tokenTtlHours }，启动期会自动迁移到 v2 并回写。
 */
export interface AuthConfig {
  version: 2
  passwordHash: string
  passwordIsDefault: boolean
  secret: string
  tokenTtlHours: number
}

const DEFAULT_PASSWORD = "admin"
const DEFAULT_TTL_HOURS = 24 * 7
const SCRYPT_KEYLEN = 64
const SCRYPT_SALT_BYTES = 16

const scryptAsync = promisify(crypto.scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>

async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.randomBytes(SCRYPT_SALT_BYTES)
  const hash = await scryptAsync(plain, salt, SCRYPT_KEYLEN)
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`
}

async function verifyPasswordHash(plain: string, encoded: string): Promise<boolean> {
  const parts = encoded.split(":")
  if (parts.length !== 3 || parts[0] !== "scrypt") return false
  const [, saltHex, hashHex] = parts
  let salt: Buffer, expected: Buffer
  try {
    salt = Buffer.from(saltHex, "hex")
    expected = Buffer.from(hashHex, "hex")
  } catch {
    return false
  }
  const actual = await scryptAsync(plain, salt, expected.length)
  if (actual.length !== expected.length) return false
  return crypto.timingSafeEqual(actual, expected)
}

export class AuthService {
  private cache: AuthConfig | null = null

  constructor(private readonly filePath: string) {}

  getPath(): string {
    return this.filePath
  }

  /** 加密用主密钥（16 进制串），等同于 token 签名密钥 */
  async getSecret(): Promise<string> {
    const cfg = await this.load()
    return cfg.secret
  }

  /** 当前密码是否仍为安装期默认值 */
  async isPasswordDefault(): Promise<boolean> {
    const cfg = await this.load()
    return cfg.passwordIsDefault
  }

  /** 读取（或首次创建）auth 配置；自动从 v1 迁移到 v2 */
  async load(): Promise<AuthConfig> {
    if (this.cache) return this.cache

    let raw: string | null = null
    try {
      raw = await fs.readFile(this.filePath, "utf8")
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
    }

    if (raw === null) {
      const initial: AuthConfig = {
        version: 2,
        passwordHash: await hashPassword(DEFAULT_PASSWORD),
        passwordIsDefault: true,
        secret: crypto.randomBytes(32).toString("hex"),
        tokenTtlHours: DEFAULT_TTL_HOURS,
      }
      await this.persist(initial)
      console.warn(
        `[FRP Manager] auth.json 不存在，已生成默认配置：${this.filePath}\n` +
          `              默认密码: ${DEFAULT_PASSWORD}（请通过 UI「修改密码」按钮或编辑该文件修改）`,
      )
      this.cache = initial
      return initial
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
      throw new Error(`auth.json 解析失败: ${this.filePath}`)
    }

    // v2 直接读取
    if (parsed.version === 2 && typeof parsed.passwordHash === "string") {
      const config: AuthConfig = {
        version: 2,
        passwordHash: parsed.passwordHash,
        passwordIsDefault:
          typeof parsed.passwordIsDefault === "boolean" ? parsed.passwordIsDefault : false,
        secret:
          typeof parsed.secret === "string" && parsed.secret.length >= 32
            ? parsed.secret
            : crypto.randomBytes(32).toString("hex"),
        tokenTtlHours:
          typeof parsed.tokenTtlHours === "number" && parsed.tokenTtlHours > 0
            ? parsed.tokenTtlHours
            : DEFAULT_TTL_HOURS,
      }
      // secret 缺失/非法时已生成新值，需要回写
      if (config.secret !== parsed.secret) await this.persist(config)
      this.cache = config
      if (config.passwordIsDefault) {
        console.warn(
          "[FRP Manager] WARNING: 当前仍为默认密码 admin，建议尽快通过 UI 修改",
        )
      }
      return config
    }

    // v1 兼容：{ password, secret, tokenTtlHours }
    const legacyPwd =
      typeof parsed.password === "string" && parsed.password.length > 0
        ? parsed.password
        : DEFAULT_PASSWORD
    const config: AuthConfig = {
      version: 2,
      passwordHash: await hashPassword(legacyPwd),
      passwordIsDefault: legacyPwd === DEFAULT_PASSWORD,
      secret:
        typeof parsed.secret === "string" && parsed.secret.length >= 32
          ? parsed.secret
          : crypto.randomBytes(32).toString("hex"),
      tokenTtlHours:
        typeof parsed.tokenTtlHours === "number" && parsed.tokenTtlHours > 0
          ? parsed.tokenTtlHours
          : DEFAULT_TTL_HOURS,
    }
    await this.persist(config)
    console.warn(
      `[FRP Manager] auth.json 已从 v1 升级到 v2（密码已 scrypt hash 化，明文 password 字段已移除）`,
    )
    this.cache = config
    if (config.passwordIsDefault) {
      console.warn("[FRP Manager] WARNING: 当前仍为默认密码 admin，建议尽快通过 UI 修改")
    }
    return config
  }

  /** 校验明文密码 */
  async verifyPassword(password: string): Promise<boolean> {
    if (typeof password !== "string" || password.length === 0) return false
    const cfg = await this.load()
    return verifyPasswordHash(password, cfg.passwordHash)
  }

  /** 修改密码：先校验旧密码，再写入新 hash；可选地轮转 secret 让历史 token 全部失效 */
  async changePassword(
    oldPassword: string,
    newPassword: string,
    options: { rotateSecret?: boolean } = {},
  ): Promise<{ rotated: boolean }> {
    const cfg = await this.load()
    const ok = await verifyPasswordHash(oldPassword, cfg.passwordHash)
    if (!ok) {
      const err = new Error("OLD_PASSWORD_INVALID")
      err.name = "OldPasswordInvalidError"
      throw err
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      const err = new Error("WEAK_PASSWORD")
      err.name = "WeakPasswordError"
      throw err
    }
    const next: AuthConfig = {
      ...cfg,
      passwordHash: await hashPassword(newPassword),
      passwordIsDefault: newPassword === DEFAULT_PASSWORD,
      secret: options.rotateSecret ? crypto.randomBytes(32).toString("hex") : cfg.secret,
    }
    this.cache = next
    await this.persist(next)
    return { rotated: !!options.rotateSecret }
  }

  /** 签发 token：`<expMs>.<hmacHex>` */
  async issueToken(): Promise<{ token: string; expiresAt: number }> {
    const cfg = await this.load()
    const expiresAt = Date.now() + cfg.tokenTtlHours * 3600_000
    const payload = String(expiresAt)
    const sig = crypto.createHmac("sha256", cfg.secret).update(payload).digest("hex")
    return { token: `${payload}.${sig}`, expiresAt }
  }

  /** 校验 token 有效性 */
  async verifyToken(token: string | undefined): Promise<boolean> {
    if (!token) return false
    const cfg = await this.load()
    const idx = token.indexOf(".")
    if (idx <= 0) return false
    const exp = token.slice(0, idx)
    const sig = token.slice(idx + 1)
    if (!/^\d+$/.test(exp)) return false

    const expected = crypto.createHmac("sha256", cfg.secret).update(exp).digest("hex")
    const sigBuf = Buffer.from(sig, "hex")
    const expBuf = Buffer.from(expected, "hex")
    if (sigBuf.length === 0 || sigBuf.length !== expBuf.length) return false
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false

    if (Number(exp) <= Date.now()) return false
    return true
  }

  private async persist(cfg: AuthConfig): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    await fs.writeFile(this.filePath, JSON.stringify(cfg, null, 2) + "\n", "utf8")
  }
}

/** 解析默认 auth.json 路径：优先环境变量，dev 缺省取 ../../config/auth.json */
export function resolveAuthPath(): string {
  if (process.env.FRP_MANAGER_AUTH_PATH) {
    return path.resolve(process.env.FRP_MANAGER_AUTH_PATH)
  }
  return path.resolve(process.cwd(), "../../config/auth.json")
}
