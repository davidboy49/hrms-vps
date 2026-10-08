import { NextResponse, type NextRequest } from "next/server"
import { SignJWT, jwtVerify } from "jose"

const RENEW_AFTER_SEC = 24 * 3600

/**
 * Cheap first gate: no valid signed cookie means off to the login page.
 * This only checks the signature. Whether the user is still active, and their role, is checked
 * against the database in getSession(), which every page and action uses.
 *
 * It also renews a "stay signed in" cookie once a day, so the 30 or 90 days count from the last visit
 * and not from the day of sign-in.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === "/login" || pathname === "/login/2fa") return NextResponse.next()

  const token = req.cookies.get("pd_session")?.value
  const secret = process.env.AUTH_SECRET ? new TextEncoder().encode(process.env.AUTH_SECRET) : null
  let payload: { id?: unknown; v?: unknown; d?: unknown; iat?: number } | null = null
  if (token && secret) {
    try {
      payload = (await jwtVerify(token, secret, { algorithms: ["HS256"] })).payload
    } catch {}
  }
  if (!payload || !secret) {
    const url = new URL("/login", req.url)
    if (pathname !== "/") url.searchParams.set("next", pathname + req.nextUrl.search)
    return NextResponse.redirect(url)
  }

  const res = NextResponse.next()
  const days = typeof payload.d === "number" ? payload.d : 0
  if (days > 0 && typeof payload.id === "string" && typeof payload.v === "number" && Date.now() / 1000 - (payload.iat ?? 0) > RENEW_AFTER_SEC) {
    const fresh = await new SignJWT({ id: payload.id, v: payload.v, d: days }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${days}d`).sign(secret)
    res.cookies.set("pd_session", fresh, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: days * 86400 })
  }
  return res
}

export const config = {
  // device push endpoints and public assets handle themselves
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads/|iclock/|api/logo|api/cron/|api/health|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
}
