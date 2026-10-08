"use server"

import bcrypt from "bcrypt"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { createSession, getPendingPasswordUser, sessionDays } from "@/lib/session"
import { BCRYPT_COST, passwordSchema } from "@/lib/password"
import { audit } from "@/lib/audit"
import { rateLimit, waitText } from "@/lib/rate-limit"
import { getT } from "@/i18n/server"

export type ChangeState = { error?: string }

/** First sign-in after a bulk create: replace the temporary password with one the person chooses. */
export async function completePasswordChange(_: ChangeState, form: FormData): Promise<ChangeState> {
  const t = await getT()
  const me = await getPendingPasswordUser()
  if (!me) redirect("/login")
  const lim = await rateLimit(`pw:${me.id}`, 10, 15 * 60)
  if (!lim.ok) return { error: t("users.err.rate", { wait: waitText(lim.retryAfter, t) }) }

  const next = String(form.get("next") ?? "")
  const again = String(form.get("again") ?? "")
  const p = passwordSchema.safeParse(next)
  if (!p.success) return { error: p.error.issues[0].message }
  if (next !== again) return { error: "cp.err.match" }

  const u = await db.user.findUnique({ where: { id: me.id } })
  if (!u || !u.mustChangePassword) redirect("/")
  if (await bcrypt.compare(next, u.passwordHash)) return { error: "users.err.samePw" }

  const updated = await db.user.update({
    where: { id: u.id },
    data: { passwordHash: await bcrypt.hash(next, BCRYPT_COST), mustChangePassword: false, tempPasswordExpiresAt: null, failedLogins: 0, lockedUntil: null, tokenVersion: { increment: 1 } },
  })
  // the version bump signs out any other device; keep this one
  await createSession({ id: updated.id, tokenVersion: updated.tokenVersion }, sessionDays(me.perms, true))
  await audit(u.id, "password-first", "User", u.id)
  redirect(me.perms.includes("employees.view") ? "/employees" : "/scan")
}
