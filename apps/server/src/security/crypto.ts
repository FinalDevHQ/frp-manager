import crypto from "node:crypto"
import type { ReloadStrategy } from "@frp-manager/shared"

/**
 * 用 auth.json.secret 派生加密 key（SHA-256(secret) 的前 32 字节作为 AES-256 key）。
 * 同一个 secret 在 token 签名（HMAC）与字段加密之间复用，避免引入额外密钥管理。
 */
const ENC_PREFIX = "enc:v1:"
export const MASKED_PASSWORD = "***"

function deriveKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret, "utf8").digest()
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(ENC_PREFIX)
}

export function isMasked(value: unknown): value is string {
  return value === MASKED_PASSWORD
}

/** 加密为 enc:v1:<iv-b64>:<cipher-b64>:<tag-b64> */
export function encryptString(plain: string, secret: string): string {
  const key = deriveKey(secret)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return (
    ENC_PREFIX +
    iv.toString("base64") +
    ":" +
    enc.toString("base64") +
    ":" +
    tag.toString("base64")
  )
}

export function decryptString(payload: string, secret: string): string {
  if (!isEncrypted(payload)) return payload
  const body = payload.slice(ENC_PREFIX.length)
  const parts = body.split(":")
  if (parts.length !== 3) throw new Error("加密负载格式错误")
  const [ivB64, encB64, tagB64] = parts
  const key = deriveKey(secret)
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))
  const dec = Buffer.concat([
    decipher.update(Buffer.from(encB64, "base64")),
    decipher.final(),
  ])
  return dec.toString("utf8")
}

/**
 * 对 reload strategy 做「面向客户端」的脱敏：把已加密的 admin-api 密码替换为 ***。
 * 未加密（旧数据）也一并脱敏，避免明文泄露给前端。
 */
export function maskStrategyForClient(strategy: ReloadStrategy): ReloadStrategy {
  if (strategy.type === "admin-api" && strategy.password) {
    return { ...strategy, password: MASKED_PASSWORD }
  }
  return strategy
}

/**
 * 对 reload strategy 做「准备执行」处理：解密 admin-api 密码。
 * 解密失败时直接返回原始字符串（向后兼容；明文场景会原样使用）。
 */
export function unmaskStrategyForExecute(
  strategy: ReloadStrategy,
  secret: string,
): ReloadStrategy {
  if (strategy.type === "admin-api" && isEncrypted(strategy.password)) {
    return { ...strategy, password: decryptString(strategy.password, secret) }
  }
  return strategy
}

/**
 * 对 reload strategy 做「准备持久化」处理：admin-api 密码若是明文，加密为 enc:v1:。
 * 入参中如果是 MASKED_PASSWORD（来自前端的「保持原值」），交由调用方处理（这里直接保留 mask）。
 */
export function encryptStrategyForStorage(
  strategy: ReloadStrategy,
  secret: string,
): ReloadStrategy {
  if (strategy.type !== "admin-api") return strategy
  const pwd = strategy.password
  if (!pwd) return strategy
  if (isEncrypted(pwd)) return strategy
  if (isMasked(pwd)) return strategy
  return { ...strategy, password: encryptString(pwd, secret) }
}
