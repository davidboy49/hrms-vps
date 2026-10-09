"use server"

import bcrypt from "bcrypt"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { createSession, destroySession, permsOf, sessionDays } from "@/lib/session"
import { audit } from "@/lib/audit"
import { clientIp, rateLimit, rateLimitPeek, waitText } from "@/lib/rate-limit"
import { beginTwoFactor } from "@/lib/twofactor"
import { esc, sendTelegram } from "@/lib/telegram"
import { getT } from "@/i18n/server"

export type LoginState = { error?: string }

const MAX_FAILS = 5
const IP_MAX_FAILS = 60
// lock grows with repeat lockouts in the last hour, so a forgetful user waits a minute but a guesser waits longer
const LOCK_STEPS_MIN = [1, 5, 15]
// one account failing from this many different IPs inside the window looks like a distributed attack
const SPREAD_IPS = 3
const SPREAD_MIN = 10
// compared when the account is unknown, so known and unknown accounts take the same time
let dummyHash: Promise<string> | null = null
const dummy = () => (dummyHash ??= bcrypt.hash("not-a-real-password", 12))

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const t = await getT()
  // a username, or an email for people who have one
  const who = String(form.get("username") ?? "").trim().toLowerCase().slice(0, 254)
  const password = String(form.get("password") ?? "").slice(0, 200)
  const remember = form.get("remember") === "on"
  const nextRaw = String(form.get("next") ?? "")
  // only same-site paths, never an absolute or protocol-relative URL
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.startsWith("/\\") && !nextRaw.startsWith("/login") ? nextRaw : null
  if (!who || !password) return { error: t("login.err.required") }

  // per-IP limit: stops one source trying many accounts or many passwords. Generous because a whole office shares one public IP
  const ip = await clientIp()
  // only failed attempts count, so a whole office signing in correctly is never blocked
  const lim = await rateLimitPeek(`login:ip:${ip}`, IP_MAX_FAILS, 15 * 60)
  if (!lim.ok) return { error: t("login.err.network", { wait: waitText(lim.retryAfter, t) }) }

  const user = await db.user.findFirst({ where: { OR: [{ username: who }, { email: who }] }, include: { role: { select: { key: true, permissions: true } } } })
  const generic = { error: t("login.err.wrong") }

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await bcrypt.compare(password, user.passwordHash) // keep timing similar
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
    return { error: t("login.err.locked", { mins }) }
  }

  const ok = await bcrypt.compare(password, user?.passwordHash ?? (await dummy()))
  // right password, but the person was deactivated: say so, instead of a confusing "wrong password" (not counted as a failed attempt)
  if (user && ok && !user.isActive) {
    await audit(user.id, "login-deactivated", "User", user.id, `ip ${ip}`)
    return { error: t("login.err.deactivated") }
  }
  if (!user || !user.isActive || !ok) {
    await rateLimit(`login:ip:${ip}`, IP_MAX_FAILS, 15 * 60)
    if (user) {
      const fails = user.failedLogins + 1
      if (fails >= MAX_FAILS) {
        const earlier = await db.auditLog.count({ where: { userId: user.id, action: "login-locked", createdAt: { gt: new Date(Date.now() - 60 * 60000) } } })
        const lockMin = LOCK_STEPS_MIN[Math.min(earlier, LOCK_STEPS_MIN.length - 1)]
        await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: new Date(Date.now() + lockMin * 60000) } })
        await audit(user.id, "login-locked", "User", user.id, `${lockMin} min`)
      } else {
        await db.user.update({ where: { id: user.id }, data: { failedLogins: fails } })
      }
    }
    await audit(user?.id ?? null, "login-failed", "User", user?.id, `ip ${ip}`)
    if (user) await alertIfSpread(user.id, user.username)
    return generic
  }

  // a temporary password from a bulk create stops working after a while; HR resets it
  if (user.mustChangePassword && user.tempPasswordExpiresAt && user.tempPasswordExpiresAt < new Date()) return { error: t("login.err.tempExpired") }

  // an Admin switched on two-factor for this person: no session yet, they still have to enter an authenticator code
  if (user.totpRequired) {
    await beginTwoFactor({ uid: user.id, days: sessionDays(permsOf(user.role), remember), next })
    redirect("/login/2fa")
  }

  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } })
  await createSession({ id: user.id, tokenVersion: user.tokenVersion }, sessionDays(permsOf(user.role), remember))
  await audit(user.id, "login", "User", user.id, `ip ${ip}`)
  // first sign-in with a temporary password: choose their own before anything else
  if (user.mustChangePassword) redirect("/change-password")
  redirect(next ?? (permsOf(user.role).includes("employees.view") ? "/employees" : "/scan"))
}

/** Tells the Telegram group when one account is being guessed from several IPs at once. Never blocks or slows a login. */
async function alertIfSpread(userId: string, username: string) {
  try {
    const rows = await db.auditLog.findMany({
      where: { userId, action: "login-failed", createdAt: { gt: new Date(Date.now() - SPREAD_MIN * 60000) } },
      select: { detail: true },
      take: 200,
    })
    const ips = new Set(rows.map((r) => r.detail ?? "").filter(Boolean))
    if (ips.size < SPREAD_IPS) return
    if (!(await rateLimit(`login:spread:${userId}`, 1, 30 * 60)).ok) return
    await sendTelegram(`🚨 <b>Possible login attack</b>\nAccount <code>${esc(username)}</code> failed to log in from ${ips.size} different IPs in ${SPREAD_MIN} min (${rows.length} attempts).`)
  } catch (e) {
    console.error("spread alert failed:", (e as Error).message)
  }
}

export async function logout() {
  await destroySession()
  redirect("/login")
}
