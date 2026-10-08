"use server"

import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { createSession, permsOf } from "@/lib/session"
import { audit } from "@/lib/audit"
import { clientIp, rateLimit, waitText } from "@/lib/rate-limit"
import { clearPending, readPending } from "@/lib/twofactor"
import { decryptSecret } from "@/lib/crypto-secret"
import { matchRecovery, matchStep, newRecoveryCodes } from "@/lib/totp"
import { getT } from "@/i18n/server"

export type TwoFaState = { error?: string; codes?: string[]; to?: string }

const MAX_FAILS = 5
const LOCK_MIN = 15

export async function verifyTwoFactor(_: TwoFaState, form: FormData): Promise<TwoFaState> {
  const t = await getT()
  const pending = await readPending()
  if (!pending) redirect("/login")
  const input = String(form.get("code") ?? "").trim().slice(0, 32)
  if (!input) return { error: t("tfa.err.required") }

  const ip = await clientIp()
  const lim = await rateLimit(`2fa:ip:${ip}`, 30, 15 * 60)
  if (!lim.ok) return { error: t("login.err.network", { wait: waitText(lim.retryAfter, t) }) }

  const user = await db.user.findUnique({ where: { id: pending.uid }, include: { role: { select: { key: true, permissions: true } } } })
  if (!user || !user.isActive || !user.totpRequired || !user.totpSecret) {
    await clearPending()
    redirect("/login")
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) return { error: t("login.err.locked", { mins: Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000) }) }

  const secret = decryptSecret(user.totpSecret)
  const enrolled = user.totpEnabledAt !== null
  let ok = false
  let usedRecovery: string | null = null
  let step: number | null = null

  if (secret) {
    step = matchStep(secret, input)
    // a code that was already accepted cannot be used again
    if (step !== null && user.totpLastStep !== null && step <= user.totpLastStep) step = null
    ok = step !== null
  }
  // recovery codes only work once setup is finished
  if (!ok && enrolled) {
    usedRecovery = matchRecovery(user.recoveryCodes, input)
    ok = usedRecovery !== null
  }

  if (!ok) {
    const fails = user.failedLogins + 1
    await db.user.update({
      where: { id: user.id },
      data: fails >= MAX_FAILS ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MIN * 60000) } : { failedLogins: fails },
    })
    await audit(user.id, "2fa-failed", "User", user.id, `ip ${ip}`)
    return { error: t("tfa.err.wrong") }
  }

  const data: Record<string, unknown> = { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }
  let codes: string[] | undefined
  if (usedRecovery) data.recoveryCodes = user.recoveryCodes.filter((c) => c !== usedRecovery)
  else data.totpLastStep = step
  if (!enrolled) {
    // first successful code: setup is done, hand out recovery codes (only their hashes are kept)
    const rc = newRecoveryCodes()
    codes = rc.codes
    data.totpEnabledAt = new Date()
    data.recoveryCodes = rc.hashes
  }
  await db.user.update({ where: { id: user.id }, data })
  await clearPending()
  await createSession({ id: user.id, tokenVersion: user.tokenVersion }, pending.days)
  await audit(user.id, usedRecovery ? "login-recovery" : enrolled ? "login" : "2fa-enrolled", "User", user.id, `ip ${ip}`)

  const to = pending.next ?? (permsOf(user.role).includes("employees.view") ? "/employees" : "/scan")
  if (codes) return { codes, to } // show them once, then the person continues
  redirect(to)
}

export async function cancelTwoFactor() {
  await clearPending()
  redirect("/login")
}
