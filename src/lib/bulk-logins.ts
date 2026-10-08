import bcrypt from "bcrypt"
import { randomInt } from "node:crypto"
import { db } from "@/lib/db"
import { permsOf, type SessionUser } from "@/lib/session"
import { suggestUsername, usernameSchema } from "@/lib/username"
import type { Permission } from "@/lib/permissions"

/** Most logins one batch may create. Keeps the request short and a mistake small. */
export const MAX_BATCH = 300
/**
 * Work factor for the hash of a temporary password. These are 12 random characters (about 70 bits), so a stolen hash cannot be guessed at
 * any cost, and each one is replaced by a full-strength hash (BCRYPT_COST) the first time the person chooses their own password.
 * A lower cost keeps a batch of 300 well inside the proxy's 60 second limit.
 */
const TEMP_COST = 10
/** How long a temporary password works before HR has to reset it. */
export const TEMP_PASSWORD_DAYS = 14

/** Permissions that only an Admin may hand out through a batch. */
const PRIVILEGED: Permission[] = ["users.manage", "users.createBatch", "roles.manage", "settings.manage"]

// no 0/O, 1/l/I: slips get read aloud and typed on phones
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"
const LOWER = "abcdefghjkmnpqrstuvwxyz"
const DIGIT = "23456789"
const ALL = UPPER + LOWER + DIGIT

/** 12 random characters with at least one upper, lower and digit. Uses the OS random source, never Math.random. */
export function generatePassword(): string {
  for (;;) {
    const p = Array.from({ length: 12 }, () => ALL[randomInt(ALL.length)]).join("")
    if ([UPPER, LOWER, DIGIT].every((set) => [...p].some((c) => set.includes(c)))) return p
  }
}

export type SkipReason = "hasLogin" | "inactive" | "deleted" | "notFound" | "usernameInvalid" | "usernameTaken" | "duplicate"
export type Skipped = { employeeNo: string; name: string; reason: SkipReason }
export type Planned = { employeeId: string; employeeNo: string; name: string; username: string }
export type Plan = { role: { id: string; name: string }; planned: Planned[]; skipped: Skipped[] }

/** Roles this person may give out in a batch: an Admin any, everyone else only roles with no administrative power. */
export async function grantableRoles(actor: SessionUser) {
  const roles = await db.appRole.findMany({ orderBy: { name: "asc" }, select: { id: true, key: true, name: true, permissions: true } })
  const isAdmin = actor.role === "ADMIN"
  return roles
    .filter((r) => {
      if (isAdmin) return true
      const perms = permsOf(r)
      return perms.every((p) => actor.perms.includes(p)) && !perms.some((p) => PRIVILEGED.includes(p))
    })
    .map((r) => ({ id: r.id, name: r.name, key: r.key }))
}

/** Works out who would get a login, and who is skipped and why. Writes nothing. */
export async function planBatch(actor: SessionUser, employeeIds: string[], roleId: string): Promise<Plan | { error: "role" | "empty" | "tooMany" }> {
  const role = (await grantableRoles(actor)).find((r) => r.id === roleId)
  if (!role) return { error: "role" }
  const ids = [...new Set(employeeIds)]
  if (ids.length === 0) return { error: "empty" }
  if (ids.length > MAX_BATCH) return { error: "tooMany" }

  const emps = await db.employee.findMany({
    where: { id: { in: ids } },
    select: { id: true, employeeNo: true, nameEn: true, deletedAt: true, status: { select: { countsAsActive: true } }, user: { select: { id: true } } },
  })
  const skipped: Skipped[] = []
  const candidates: Planned[] = []
  const found = new Set(emps.map((e) => e.id))
  for (const id of ids) if (!found.has(id)) skipped.push({ employeeNo: "?", name: id, reason: "notFound" })

  const seen = new Set<string>()
  for (const e of emps.sort((a, b) => a.employeeNo.localeCompare(b.employeeNo))) {
    const base = { employeeNo: e.employeeNo, name: e.nameEn }
    if (e.deletedAt) { skipped.push({ ...base, reason: "deleted" }); continue }
    if (!e.status.countsAsActive) { skipped.push({ ...base, reason: "inactive" }); continue }
    if (e.user) { skipped.push({ ...base, reason: "hasLogin" }); continue }
    const parsed = usernameSchema.safeParse(suggestUsername(e.employeeNo))
    if (!parsed.success) { skipped.push({ ...base, reason: "usernameInvalid" }); continue }
    if (seen.has(parsed.data)) { skipped.push({ ...base, reason: "duplicate" }); continue }
    seen.add(parsed.data)
    candidates.push({ employeeId: e.id, ...base, username: parsed.data })
  }
  const taken = new Set((await db.user.findMany({ where: { username: { in: candidates.map((c) => c.username) } }, select: { username: true } })).map((u) => u.username))
  const planned = candidates.filter((c) => {
    if (!taken.has(c.username)) return true
    skipped.push({ employeeNo: c.employeeNo, name: c.name, reason: "usernameTaken" })
    return false
  })
  return { role: { id: role.id, name: role.name }, planned, skipped }
}

export type Created = { employeeNo: string; name: string; username: string; password: string }

/** Creates the logins from a plan. Passwords are hashed first (in parallel groups, off the main thread), then all rows go in one transaction. */
export async function createFromPlan(plan: Plan): Promise<Created[]> {
  const rows = plan.planned.map((p) => ({ ...p, password: generatePassword() }))
  const hashes: string[] = []
  for (let i = 0; i < rows.length; i += 20) {
    hashes.push(...(await Promise.all(rows.slice(i, i + 20).map((r) => bcrypt.hash(r.password, TEMP_COST)))))
  }
  const expires = new Date(Date.now() + TEMP_PASSWORD_DAYS * 86400_000)
  await db.$transaction(
    async (tx) => {
      // employeeId and username are unique, so a second HR user running the same batch at the same moment fails here and rolls everything back
      await tx.user.createMany({
        data: rows.map((r, i) => ({
          username: r.username,
          name: r.name,
          roleId: plan.role.id,
          employeeId: r.employeeId,
          passwordHash: hashes[i],
          mustChangePassword: true,
          tempPasswordExpiresAt: expires,
        })),
      })
    },
    { timeout: 30_000 },
  )
  return rows.map((r) => ({ employeeNo: r.employeeNo, name: r.name, username: r.username, password: r.password }))
}
