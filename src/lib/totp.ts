import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto"

// Standard authenticator codes (RFC 6238: HMAC-SHA1, 6 digits, 30-second steps), so Google Authenticator,
// Microsoft Authenticator, Authy and others all work.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
const STEP_SEC = 30

export function newSecret() {
  const bytes = randomBytes(20)
  let bits = 0
  let value = 0
  let out = ""
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  return out
}

function decode(secret: string) {
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of secret.replace(/=+$/, "").toUpperCase()) {
    const i = ALPHABET.indexOf(ch)
    if (i < 0) continue
    value = (value << 5) | i
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

function codeAt(secret: string, step: number) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const h = createHmac("sha1", decode(secret)).update(counter).digest()
  const o = h[h.length - 1] & 15
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(n % 1_000_000).padStart(6, "0")
}

/** The step number that matches `code` (one step either side allowed for clock drift), or null. */
export function matchStep(secret: string, code: string, now = Date.now()): number | null {
  const clean = code.replace(/\s+/g, "")
  if (!/^\d{6}$/.test(clean)) return null
  const current = Math.floor(now / 1000 / STEP_SEC)
  for (const step of [current, current - 1, current + 1]) {
    const want = Buffer.from(codeAt(secret, step))
    if (timingSafeEqual(want, Buffer.from(clean))) return step
  }
  return null
}

export function otpauthUri(secret: string, account: string, issuer: string) {
  const label = encodeURIComponent(`${issuer}:${account}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SEC}`
}

const hash = (code: string) => createHash("sha256").update(code.replace(/[\s-]/g, "").toUpperCase()).digest("hex")

/** Ten random characters in two groups, e.g. "K7QD2-MX4TA". Only the hashes are stored. */
export function newRecoveryCodes(n = 8) {
  const codes = Array.from({ length: n }, () => {
    const c = Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")
    return `${c.slice(0, 5)}-${c.slice(5)}`
  })
  return { codes, hashes: codes.map(hash) }
}

/** The stored hash that matches this recovery code, or null. */
export function matchRecovery(stored: string[], input: string) {
  const h = hash(input)
  return stored.find((s) => s.length === h.length && timingSafeEqual(Buffer.from(s), Buffer.from(h))) ?? null
}
