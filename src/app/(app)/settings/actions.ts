"use server"

import bcrypt from "bcrypt"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { assertPerm, getSession, permsOf } from "@/lib/session"
import { audit } from "@/lib/audit"
import { BCRYPT_COST, passwordSchema } from "@/lib/password"
import { rateLimit, waitText } from "@/lib/rate-limit"
import { getT } from "@/i18n/server"
import { usernameSchema } from "@/lib/username"
import { createSession, sessionDays } from "@/lib/session"
import { removePhoto, savePhoto } from "@/lib/uploads"

type R = { error?: string; ok?: boolean }

const SETTING_KEYS = ["company.name", "company.currency", "scan.khmerOnly", "attendance.suspicious", "attendance.suspiciousLevel", "employee.prefix", "attendance.lateGraceMin", "log.lateAfterMin", "log.earlyBeforeMin"] as const

export async function saveSettings(form: FormData): Promise<R> {
  const t = await getT()
  const user = await assertPerm("settings.manage")
  for (const k of SETTING_KEYS) {
    const v = form.get(k)
    if (v == null) continue
    const value = String(v).trim()
    if (k === "scan.khmerOnly" && value !== "0" && value !== "1") continue
    if (k === "attendance.suspicious" && value !== "0" && value !== "1") continue
    if (k === "attendance.suspiciousLevel" && !["low", "medium", "high"].includes(value)) continue
    if (k === "employee.prefix" && !/^[A-Za-z0-9-]{1,8}$/.test(value)) return { error: t("set.err.prefix") }
    if ((k === "log.lateAfterMin" || k === "log.earlyBeforeMin") && !(Number(value) >= 0 && Number(value) <= 240)) return { error: t("set.err.minutes240") }
    if (k === "attendance.lateGraceMin" && !(Number(value) >= 0 && Number(value) <= 120)) return { error: t("set.err.minutes120") }
    await db.setting.upsert({ where: { key: k }, update: { value }, create: { key: k, value } })
  }
  await audit(user.id, "update", "Setting")
  revalidatePath("/settings")
  return { ok: true }
}

const pw = passwordSchema

/** True when some other active user can still manage users (Admin role, or a role granted users.manage). */
async function anotherUserAdmin(exceptId: string) {
  const others = await db.user.findMany({ where: { isActive: true, NOT: { id: exceptId } }, select: { role: { select: { key: true, permissions: true } } } })
  return others.some((u) => permsOf(u.role).includes("users.manage"))
}

const newUser = z.object({
  name: z.string().trim().min(1, "err.nameReq"),
  username: usernameSchema,
  email: z.string().trim().toLowerCase().email("err.emailInvalid").optional().or(z.literal("")),
  roleId: z.string().min(1, "users.err.role"),
  employeeId: z.string().optional(),
  password: pw,
})

export async function createUser(form: FormData): Promise<R> {
  const t = await getT()
  const admin = await assertPerm("users.manage")
  const p = newUser.safeParse(Object.fromEntries(form.entries()))
  if (!p.success) return { error: t(p.error.issues[0].message) }
  const email = p.data.email || null
  if (await db.user.findUnique({ where: { username: p.data.username } })) return { error: t("users.err.dupUsername") }
  if (email && (await db.user.findUnique({ where: { email } }))) return { error: t("users.err.dupEmail") }
  const employeeId = p.data.employeeId || null
  if (employeeId && (await db.user.findUnique({ where: { employeeId } }))) return { error: t("users.err.empHasLogin") }
  if (!(await db.appRole.findUnique({ where: { id: p.data.roleId } }))) return { error: t("users.err.role") }
  const u = await db.user.create({ data: { name: p.data.name, username: p.data.username, email, roleId: p.data.roleId, employeeId, passwordHash: await bcrypt.hash(p.data.password, BCRYPT_COST) } })
  await audit(admin.id, "create", "User", u.id, u.username)
  revalidatePath("/settings")
  return { ok: true }
}

export async function updateUser(id: string, patch: { name?: string; username?: string; email?: string; roleId?: string; employeeId?: string | null; isActive?: boolean; password?: string }): Promise<R> {
  const t = await getT()
  const admin = await assertPerm("users.manage")
  if (id === admin.id && patch.isActive === false) return { error: t("users.err.self") }
  if (patch.roleId) {
    const role = await db.appRole.findUnique({ where: { id: patch.roleId } })
    if (!role) return { error: t("users.err.role") }
    // never let the last person who can manage users lose that ability
    if (!permsOf(role).includes("users.manage") && !(await anotherUserAdmin(id))) return { error: t("users.err.lastAdmin") }
  }
  if (patch.isActive === false && !(await anotherUserAdmin(id))) return { error: t("users.err.lastAdmin") }
  const data: Record<string, unknown> = {}
  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (!name) return { error: t("err.nameReq") }
    data.name = name
  }
  if (patch.username !== undefined) {
    const u = usernameSchema.safeParse(patch.username)
    if (!u.success) return { error: t(u.error.issues[0].message) }
    if (await db.user.findFirst({ where: { username: u.data, NOT: { id } } })) return { error: t("users.err.dupUsername") }
    data.username = u.data
  }
  if (patch.email !== undefined) {
    const email = patch.email.trim().toLowerCase()
    if (email) {
      if (!z.string().email().safeParse(email).success) return { error: t("err.emailInvalid") }
      if (await db.user.findFirst({ where: { email, NOT: { id } } })) return { error: t("users.err.dupEmail") }
    }
    data.email = email || null
  }
  if (patch.roleId) data.roleId = patch.roleId
  if (patch.roleId || patch.isActive === false || patch.password !== undefined) data.tokenVersion = { increment: 1 }
  if (patch.employeeId !== undefined) {
    const eid = patch.employeeId || null
    if (eid && (await db.user.findFirst({ where: { employeeId: eid, NOT: { id } } }))) return { error: t("users.err.empHasLogin") }
    data.employeeId = eid
  }
  if (patch.isActive !== undefined) data.isActive = patch.isActive
  if (patch.password !== undefined) {
    const p = pw.safeParse(patch.password)
    if (!p.success) return { error: t(p.error.issues[0].message) }
    data.passwordHash = await bcrypt.hash(patch.password, BCRYPT_COST)
    data.failedLogins = 0
    data.lockedUntil = null
  }
  await db.user.update({ where: { id }, data })
  await audit(admin.id, "update", "User", id, Object.keys(patch).join(","))
  revalidatePath("/settings")
  return { ok: true }
}

/** Only the Admin role decides who needs two-factor (not just anyone who can manage users). */
async function assertAdminRole() {
  const me = await assertPerm("users.manage")
  if (me.role !== "ADMIN") throw new Error("Not allowed")
  return me
}

/** Turn "must use an authenticator app" on or off for one person. Turning it on signs them out so the next sign-in asks for setup. */
export async function setTwoFactorRequired(id: string, required: boolean): Promise<R> {
  const admin = await assertAdminRole()
  if (required) {
    await db.user.update({ where: { id }, data: { totpRequired: true, ...(id === admin.id ? {} : { tokenVersion: { increment: 1 } }) } })
  } else {
    await db.user.update({ where: { id }, data: { totpRequired: false, totpSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: [] } })
  }
  await audit(admin.id, required ? "2fa-required" : "2fa-off", "User", id)
  revalidatePath("/settings")
  return { ok: true }
}

/** Lost phone: forget the authenticator and recovery codes. They set up again at their next sign-in, and old sessions end. */
export async function resetTwoFactor(id: string): Promise<R> {
  const admin = await assertAdminRole()
  await db.user.update({ where: { id }, data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: [], tokenVersion: { increment: 1 } } })
  await audit(admin.id, "2fa-reset", "User", id)
  revalidatePath("/settings")
  return { ok: true }
}

export async function changeOwnPassword(form: FormData): Promise<R> {
  const t = await getT()
  const s = await getSession()
  if (!s) return { error: t("users.err.signedOut") }
  const lim = await rateLimit(`pw:${s.id}`, 5, 15 * 60)
  if (!lim.ok) return { error: t("users.err.rate", { wait: waitText(lim.retryAfter, t) }) }
  const cur = String(form.get("current") ?? "")
  const next = String(form.get("next") ?? "")
  const p = pw.safeParse(next)
  if (!p.success) return { error: t(p.error.issues[0].message) }
  const u = await db.user.findUnique({ where: { id: s.id } })
  if (!u || !(await bcrypt.compare(cur, u.passwordHash))) return { error: t("users.err.curPw") }
  if (next === cur) return { error: t("users.err.samePw") }
  const updated = await db.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(next, BCRYPT_COST), tokenVersion: { increment: 1 } } })
  // every other signed-in device is signed out; keep this one
  await createSession({ id: updated.id, tokenVersion: updated.tokenVersion }, sessionDays(s.perms, true))
  await audit(u.id, "password", "User", u.id)
  return { ok: true }
}

/** Uploads or replaces the company logo shown in the sidebar and on the sign-in page. */
export async function saveCompanyLogo(form: FormData): Promise<R> {
  const t = await getT()
  const user = await assertPerm("settings.manage")
  const file = form.get("logo")
  if (!(file instanceof File) || file.size === 0) return { error: t("set.logo.err.choose") }
  const prev = await db.setting.findUnique({ where: { key: "company.logo" } })
  let ref: string
  try {
    ref = await savePhoto(file, "company-logo", "branding")
  } catch (e) {
    return { error: t((e as Error).message) }
  }
  await db.setting.upsert({ where: { key: "company.logo" }, update: { value: ref }, create: { key: "company.logo", value: ref } })
  if (prev?.value) await removePhoto(prev.value)
  await audit(user.id, "update", "Setting", undefined, "company logo")
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function removeCompanyLogo(): Promise<R> {
  const user = await assertPerm("settings.manage")
  const prev = await db.setting.findUnique({ where: { key: "company.logo" } })
  if (prev) {
    await db.setting.delete({ where: { key: "company.logo" } })
    await removePhoto(prev.value)
  }
  await audit(user.id, "delete", "Setting", undefined, "company logo")
  revalidatePath("/", "layout")
  return { ok: true }
}
