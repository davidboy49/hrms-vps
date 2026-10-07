import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

/**
 * Secrets kept in the database (such as the Telegram bot token) are encrypted with a key derived from AUTH_SECRET.
 * Reading the database alone does not reveal them. If AUTH_SECRET is ever changed, they have to be entered again.
 */
function key() {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters")
  return createHash("sha256").update(`settings-secret:${s}`).digest()
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv("aes-256-gcm", key(), iv)
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()])
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".")
}

export function decryptSecret(stored: string): string | null {
  try {
    const [v, iv, tag, data] = stored.split(".")
    if (v !== "v1") return null
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"))
    d.setAuthTag(Buffer.from(tag, "base64url"))
    return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8")
  } catch {
    return null
  }
}
