import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"

/**
 * Between "password correct" and "code correct" the person has no session. This short-lived signed cookie
 * only remembers who passed the password step, for how many days the finished sign-in should last, and where to go next.
 */
const COOKIE = "pd_2fa"
const TTL_SEC = 5 * 60

export type Pending = { uid: string; days: number; next: string | null }

function key() {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters")
  return new TextEncoder().encode(s)
}

export async function beginTwoFactor(p: Pending) {
  const token = await new SignJWT({ purpose: "2fa", uid: p.uid, d: p.days, n: p.next ?? "" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SEC}s`)
    .sign(key())
  const jar = await cookies()
  jar.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: TTL_SEC })
}

export async function readPending(): Promise<Pending | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] })
    if (payload.purpose !== "2fa" || typeof payload.uid !== "string" || typeof payload.d !== "number") return null
    return { uid: payload.uid, days: payload.d, next: typeof payload.n === "string" && payload.n ? payload.n : null }
  } catch {
    return null
  }
}

export async function clearPending() {
  ;(await cookies()).delete(COOKIE)
}
