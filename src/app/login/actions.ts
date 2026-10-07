"use server"

import bcrypt from "bcryptjs"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { createSession, destroySession, sessionDays } from "@/lib/session"
import { audit } from "@/lib/audit"
import { clientIp, rateLimit, waitText } from "@/lib/rate-limit"
import { getT } from "@/i18n/server"

export type LoginState = { error?: string }

const MAX_FAILS = 5
const LOCK_MIN = 15
// compared when the email is unknown, so known and unknown emails take the same time
let dummyHash: Promise<string> | null = null
const dummy = () => (dummyHash ??= bcrypt.hash("not-a-real-password", 12))

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const t = await getT()
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 254)
  const password = String(form.get("password") ?? "").slice(0, 200)
  const remember = form.get("remember") === "on"
  const nextRaw = String(form.get("next") ?? "")
  // only same-site paths, never an absolute or protocol-relative URL
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.startsWith("/\\") && !nextRaw.startsWith("/login") ? nextRaw : null
  if (!email || !password) return { error: t("login.err.required") }

  // per-IP limit: stops one source trying many accounts or many passwords
  const ip = await clientIp()
  const lim = await rateLimit(`login:ip:${ip}`, 30, 15 * 60)
  if (!lim.ok) return { error: t("login.err.network", { wait: waitText(lim.retryAfter, t) }) }

  const user = await db.user.findUnique({ where: { email } })
  const generic = { error: t("login.err.wrong") }

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await bcrypt.compare(password, user.passwordHash) // keep timing similar
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
    return { error: t("login.err.locked", { mins }) }
  }

  const ok = await bcrypt.compare(password, user?.passwordHash ?? (await dummy()))
  if (!user || !user.isActive || !ok) {
    if (user) {
      const fails = user.failedLogins + 1
      await db.user.update({
        where: { id: user.id },
        data: fails >= MAX_FAILS ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MIN * 60000) } : { failedLogins: fails },
      })
    }
    await audit(user?.id ?? null, "login-failed", "User", user?.id, `ip ${ip}`)
    return generic
  }

  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } })
  await createSession({ id: user.id, tokenVersion: user.tokenVersion }, sessionDays(user.role, remember))
  await audit(user.id, "login", "User", user.id, `ip ${ip}`)
  redirect(next ?? (user.role === "EMPLOYEE" ? "/scan" : "/employees"))
}

export async function logout() {
  await destroySession()
  redirect("/login")
}
