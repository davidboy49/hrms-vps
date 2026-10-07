import { createHmac, timingSafeEqual } from "node:crypto"

/** The QR on the office screen carries a token that is only valid for a short window. */
export const WINDOW_SEC = 30
/** The current and previous window are accepted, so a scan is good for 30 to 60 seconds. */
const ACCEPT_WINDOWS = 2

function secret() {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error("AUTH_SECRET is not set")
  return s
}

const sig = (payload: string) => createHmac("sha256", secret()).update(`qr:${payload}`).digest("base64url").slice(0, 22)

export function makeToken(locationId: string, now = Date.now()) {
  const w = Math.floor(now / 1000 / WINDOW_SEC)
  const payload = `${locationId}.${w}`
  return `${payload}.${sig(payload)}`
}

/**
 * Printed code: it never expires, so it carries no time. It is tied to the location and to a version number
 * kept on the location. Pressing "Regenerate" raises the version, which makes every older printout stop working.
 */
export function makeStaticToken(locationId: string, version: number) {
  const payload = `s.${locationId}.${version}`
  return `${payload}.${sig(payload)}`
}

export type TokenCheck =
  | { ok: true; kind: "rotating"; locationId: string }
  | { ok: true; kind: "static"; locationId: string; version: number }
  | { ok: false; reason: "invalid" | "expired" }

/** Handles both kinds. For a static token the caller still has to compare `version` with the location's current one. */
export function checkToken(token: string, now = Date.now()): TokenCheck {
  if (token.startsWith("s.")) {
    const parts = token.split(".")
    if (parts.length !== 4) return { ok: false, reason: "invalid" }
    const [, locationId, v, given] = parts
    const version = Number(v)
    const expect = sig(`s.${locationId}.${version}`)
    const a = Buffer.from(given)
    const b = Buffer.from(expect)
    if (!locationId || !Number.isInteger(version) || a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "invalid" }
    return { ok: true, kind: "static", locationId, version }
  }
  const r = verifyToken(token, now)
  return r.ok ? { ok: true, kind: "rotating", locationId: r.locationId } : r
}

export function verifyToken(token: string, now = Date.now()): { ok: true; locationId: string } | { ok: false; reason: "invalid" | "expired" } {
  const i = token.lastIndexOf(".")
  const j = token.lastIndexOf(".", i - 1)
  if (i < 0 || j < 0) return { ok: false, reason: "invalid" }
  const locationId = token.slice(0, j)
  const w = Number(token.slice(j + 1, i))
  const given = token.slice(i + 1)
  const expect = sig(`${locationId}.${w}`)
  const a = Buffer.from(given)
  const b = Buffer.from(expect)
  if (!locationId || !Number.isFinite(w) || a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "invalid" }
  const cur = Math.floor(now / 1000 / WINDOW_SEC)
  if (cur - w >= ACCEPT_WINDOWS || w > cur + 1) return { ok: false, reason: "expired" }
  return { ok: true, locationId }
}

/** Distance in metres between two coordinates. */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
