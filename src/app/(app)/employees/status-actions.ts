"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { db } from "@/lib/db"
import { assertPerm, permsOf } from "@/lib/session"
import { audit } from "@/lib/audit"
import { toDate } from "@/lib/format"
import { MIN_NOTE } from "@/lib/employment"
import { rateLimit, waitText } from "@/lib/rate-limit"
import { esc, sendTelegram, tgText } from "@/lib/telegram"
import { getT } from "@/i18n/server"

export type StatusResult = { ok: true } | { error: string }

const input = z.object({
  statusId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim(),
})

const DAY = 86400_000

/** True if someone other than `exceptUserId` can still manage users, so the company is never locked out of Settings. */
async function otherUserAdmin(exceptUserId: string) {
  const others = await db.user.findMany({ where: { isActive: true, NOT: { id: exceptUserId } }, select: { role: { select: { key: true, permissions: true } } } })
  return others.some((u) => permsOf(u.role).includes("users.manage"))
}

/**
 * Takes someone off the active staff list. There is no way to delete an employee: they are deactivated with a reason,
 * and everything about them (attendance, leave, pay history) is kept.
 */
export async function deactivateEmployee(id: string, raw: { statusId: string; date: string; note: string }): Promise<StatusResult> {
  const t = await getT()
  const actor = await assertPerm("employees.deactivate")
  const lim = await rateLimit(`deact:${actor.id}`, 20, 10 * 60)
  if (!lim.ok) return { error: t("emp.err.rate", { wait: waitText(lim.retryAfter, t) }) }
  const p = input.safeParse(raw)
  if (!p.success) return { error: t("emp.err.date") }
  if ([...p.data.note].length < MIN_NOTE) return { error: t("emp.err.note", { min: MIN_NOTE }) }

  const emp = await db.employee.findFirst({
    where: { id, deletedAt: null },
    include: { status: true, user: { select: { id: true, role: { select: { key: true, permissions: true } } } } },
  })
  if (!emp) return { error: t("emp.err.notFound") }
  if (!emp.status.countsAsActive) return { error: t("emp.err.alreadyInactive") }
  const target = await db.employeeStatus.findUnique({ where: { id: p.data.statusId } })
  if (!target || !target.isActive || target.countsAsActive) return { error: t("emp.err.reason") }

  const date = toDate(p.data.date)
  if (!date || date < emp.joiningDate || date.getTime() > Date.now() + 90 * DAY) return { error: t("emp.err.date") }

  if (emp.user) {
    if (emp.user.id === actor.id) return { error: t("emp.err.self") }
    if (permsOf(emp.user.role).includes("users.manage") && !(await otherUserAdmin(emp.user.id))) return { error: t("emp.err.lastAdmin") }
  }

  await db.$transaction(async (tx) => {
    await tx.employee.update({ where: { id }, data: { statusId: target.id, leavingDate: date } })
    await tx.employmentEvent.create({
      data: { employeeId: id, kind: "DEACTIVATED", fromStatus: emp.status.name, toStatus: target.name, effectiveDate: date, note: p.data.note, byUserId: actor.id, byName: actor.name },
    })
    // their login stops working and every signed-in device is signed out
    if (emp.user) await tx.user.update({ where: { id: emp.user.id }, data: { isActive: false, tokenVersion: { increment: 1 } } })
    // requests that can no longer happen: everything still waiting, and approved leave that starts after the last working day
    const leave = await tx.leaveRequest.findMany({
      where: { employeeId: id, OR: [{ status: "PENDING" }, { status: "APPROVED", fromDate: { gt: date } }] },
      select: { id: true },
    })
    if (leave.length) {
      const ids = leave.map((l) => l.id)
      await tx.rosterEntry.deleteMany({ where: { leaveRequestId: { in: ids } } })
      await tx.leaveRequest.updateMany({ where: { id: { in: ids } }, data: { status: "CANCELLED", decidedBy: actor.id, decidedAt: new Date(), decisionNote: "Employee deactivated" } })
    }
    await tx.overtimeRequest.updateMany({ where: { employeeId: id, status: "PENDING" }, data: { status: "CANCELLED", decidedBy: actor.id, decidedAt: new Date(), decisionNote: "Employee deactivated" } })
  })

  await audit(actor.id, "deactivate", "Employee", id, `${emp.employeeNo} ${emp.nameEn}: ${emp.status.name} -> ${target.name}, last day ${p.data.date}. ${p.data.note}`)
  after(async () =>
    sendTelegram(await tgText("tg.msg.deactivated", { name: esc(emp.nameEn), no: emp.employeeNo, by: esc(actor.name), status: esc(target.name), date: p.data.date, note: esc(p.data.note) })),
  )
  revalidatePath("/employees")
  revalidatePath(`/employees/${id}`)
  return { ok: true }
}

/** Brings a deactivated employee back, with a reason. Needs its own permission. */
export async function reactivateEmployee(id: string, raw: { statusId: string; date: string; note: string; enableLogin: boolean }): Promise<StatusResult> {
  const t = await getT()
  const actor = await assertPerm("employees.reactivate")
  const lim = await rateLimit(`deact:${actor.id}`, 20, 10 * 60)
  if (!lim.ok) return { error: t("emp.err.rate", { wait: waitText(lim.retryAfter, t) }) }
  const p = input.safeParse(raw)
  if (!p.success) return { error: t("emp.err.date") }
  if ([...p.data.note].length < MIN_NOTE) return { error: t("emp.err.note", { min: MIN_NOTE }) }

  const emp = await db.employee.findFirst({ where: { id, deletedAt: null }, include: { status: true, contractType: true, user: { select: { id: true } } } })
  if (!emp) return { error: t("emp.err.notFound") }
  if (emp.status.countsAsActive) return { error: t("emp.err.alreadyActive") }
  const target = await db.employeeStatus.findUnique({ where: { id: p.data.statusId } })
  if (!target || !target.isActive || !target.countsAsActive) return { error: t("emp.err.reason") }

  const date = toDate(p.data.date)
  if (!date || date < emp.joiningDate || date.getTime() > Date.now() + 30 * DAY) return { error: t("emp.err.date") }
  // a fixed-term contract that already ended needs a new end date first (done in Edit), or the person would come back with an expired contract
  if (emp.contractType.requiresEndDate && (!emp.contractEnd || emp.contractEnd < date)) return { error: t("emp.err.contractEnded") }

  await db.$transaction(async (tx) => {
    await tx.employee.update({ where: { id }, data: { statusId: target.id, leavingDate: null } })
    await tx.employmentEvent.create({
      data: { employeeId: id, kind: "REACTIVATED", fromStatus: emp.status.name, toStatus: target.name, effectiveDate: date, note: p.data.note, byUserId: actor.id, byName: actor.name },
    })
    if (raw.enableLogin === true && emp.user) await tx.user.update({ where: { id: emp.user.id }, data: { isActive: true, tokenVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null } })
  })

  await audit(actor.id, "reactivate", "Employee", id, `${emp.employeeNo} ${emp.nameEn}: ${emp.status.name} -> ${target.name}, from ${p.data.date}${raw.enableLogin && emp.user ? ", login on" : ""}. ${p.data.note}`)
  after(async () =>
    sendTelegram(await tgText("tg.msg.reactivated", { name: esc(emp.nameEn), no: emp.employeeNo, by: esc(actor.name), status: esc(target.name), date: p.data.date, note: esc(p.data.note) })),
  )
  revalidatePath("/employees")
  revalidatePath(`/employees/${id}`)
  return { ok: true }
}
