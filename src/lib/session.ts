import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"
import { db } from "@/lib/db"
import { ALL_PERMISSIONS, PAYROLL_PERMISSIONS, PERMISSION_GROUPS, can, isPermission, type Permission } from "@/lib/permissions"
import { payrollEdition } from "@/lib/edition"

export const COOKIE = "pd_session"

/**
 * How long a sign-in lasts, in days (0 = until the browser closes, and at most 12 hours).
 * Staff who check in by phone stay signed in for 90 days; managers and HR for 30 if they tick "keep me signed in".
 * Every visit renews it (see proxy.ts), so someone who uses the app regularly never has to sign in again.
 */
export function sessionDays(perms: readonly string[], remember: boolean) {
  // roles without dashboard access are field staff who check in by phone
  if (!perms.includes("dashboard.view")) return 90
  return remember ? 30 : 0
}

/** `perms` is the full list for the Admin role; other roles have what was granted in Settings → Roles. */
export type SessionUser = { id: string; username: string; email: string | null; name: string; role: string; roleName: string; roleIsSystem: boolean; perms: Permission[] }

/** Permissions of a role row. The built-in Admin always has everything, so it can never be locked out. */
export function permsOf(r: { key: string | null; permissions: string[] }): Permission[] {
  const all = r.key === "ADMIN" ? ALL_PERMISSIONS : r.permissions.filter(isPermission)
  // payroll permissions exist only in the Payroll edition
  return payrollEdition() ? all : all.filter((p) => !PAYROLL_PERMISSIONS.includes(p))
}

/** The permission groups this edition offers (the Roles screen lists these). */
export function availableGroups() {
  return PERMISSION_GROUPS.filter((g) => payrollEdition() || g.group !== "payroll")
}
type Claims = { id: string; v: number; d: number }

function key() {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters")
  return new TextEncoder().encode(s)
}

async function encrypt(claims: Claims) {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(claims.d > 0 ? `${claims.d}d` : "12h")
    .sign(key())
}

async function decrypt(token: string | undefined): Promise<Claims | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] })
    if (typeof payload.id !== "string" || typeof payload.v !== "number") return null
    return { id: payload.id, v: payload.v, d: typeof payload.d === "number" ? payload.d : 0 }
  } catch {
    return null
  }
}

/** The cookie holds only who and which token version. Name and role are always read from the database. */
export async function createSession(user: { id: string; tokenVersion: number }, days: number) {
  const token = await encrypt({ id: user.id, v: user.tokenVersion, d: days })
  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(days > 0 ? { maxAge: days * 86400 } : {}),
  })
}

export async function destroySession() {
  const jar = await cookies()
  jar.delete(COOKIE)
}

/** The signed-in user as stored, with the flag that says they still have to choose their own password. */
const loadSession = cache(async (): Promise<{ user: SessionUser; mustChange: boolean } | null> => {
  const jar = await cookies()
  const claims = await decrypt(jar.get(COOKIE)?.value)
  if (!claims) return null
  const u = await db.user.findUnique({
    where: { id: claims.id },
    select: { id: true, username: true, email: true, name: true, isActive: true, tokenVersion: true, mustChangePassword: true, role: { select: { key: true, name: true, isSystem: true, permissions: true } } },
  })
  if (!u || !u.isActive || u.tokenVersion !== claims.v) return null
  const user: SessionUser = { id: u.id, username: u.username, email: u.email, name: u.name, role: u.role.key ?? u.role.name, roleName: u.role.name, roleIsSystem: u.role.isSystem, perms: permsOf(u.role) }
  return { user, mustChange: u.mustChangePassword }
})

/**
 * The signed-in user, or null. Checked against the database on every request (once per request),
 * so disabling a user, changing their role or resetting their password takes effect immediately.
 * Someone who still has to replace a temporary password counts as not signed in everywhere except the change-password page,
 * so they cannot reach any data or action (even by calling it directly) until they have chosen their own password.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const s = await loadSession()
  return s && !s.mustChange ? s.user : null
})

/** Only for the change-password page and its action: a signed-in user who must still replace a temporary password. */
export async function getPendingPasswordUser(): Promise<SessionUser | null> {
  const s = await loadSession()
  return s?.mustChange ? s.user : null
}

export async function requireUser() {
  const u = await getSession()
  if (!u) redirect((await getPendingPasswordUser()) ? "/change-password" : "/login")
  return u
}

export { can }

export async function requirePerm(perm: Permission) {
  const u = await requireUser()
  if (!can(u, perm)) redirect("/?denied=1")
  return u
}

/** For server actions: throws instead of redirecting. */
export async function assertPerm(perm: Permission) {
  const u = await getSession()
  if (!u || !can(u, perm)) throw new Error("Not allowed")
  return u
}
