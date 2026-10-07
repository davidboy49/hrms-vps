"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { assertPerm, getSession, can } from "@/lib/session"
import { audit } from "@/lib/audit"
import { toDate } from "@/lib/format"
import { balances, workingDays } from "@/lib/leave"
import { getT } from "@/i18n/server"

type R = { ok?: boolean; error?: string }
const refresh = () => {
  revalidatePath("/leave")
  revalidatePath("/attendance/roster")
}
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

async function me() {
  const u = await getSession()
  if (!u) throw new Error("Not allowed")
  const row = await db.user.findUnique({ where: { id: u.id }, select: { employeeId: true } })
  return { ...u, employeeId: row?.employeeId ?? null }
}

const requestShape = z.object({
  employeeId: z.string().optional(),
  leaveTypeId: z.string().min(1),
  from: dateKey,
  to: dateKey,
  reason: z.string().trim().max(300).optional(),
})

/** Staff ask for their own leave; HR can also file it for someone. */
export async function requestLeave(input: z.input<typeof requestShape>): Promise<R> {
  const t = await getT()
  const u = await me()
  const p = requestShape.safeParse(input)
  if (!p.success) return { error: t("lv.err.invalid") }
  const employeeId = can(u, "leave.manage") && p.data.employeeId ? p.data.employeeId : u.employeeId
  if (!employeeId) return { error: t("lv.err.noEmployee") }
  const { from, to } = p.data
  if (to < from) return { error: t("sch.err.range") }
  const type = await db.leaveType.findUnique({ where: { id: p.data.leaveTypeId } })
  if (!type || !type.isActive) return { error: t("lv.err.invalid") }

  const days = await workingDays(employeeId, from, to)
  if (days.length === 0) return { error: t("lv.err.noDays") }
  if (days.length > 120) return { error: t("sch.err.tooLong") }

  const overlap = await db.leaveRequest.findFirst({
    where: { employeeId, status: { in: ["PENDING", "APPROVED"] }, fromDate: { lte: toDate(to)! }, toDate: { gte: toDate(from)! } },
  })
  if (overlap) return { error: t("lv.err.overlap") }

  const year = Number(from.slice(0, 4))
  const bal = (await balances(employeeId, year)).find((b) => b.typeId === type.id)
  if (bal?.allowance != null && bal.used + bal.pending + days.length > bal.allowance) {
    return { error: t("lv.err.balance", { left: Math.max(0, bal.allowance - bal.used - bal.pending) }) }
  }

  const row = await db.leaveRequest.create({
    data: { employeeId, leaveTypeId: type.id, fromDate: toDate(from)!, toDate: toDate(to)!, days: days.length, reason: p.data.reason || null, requestedBy: u.id },
  })
  await audit(u.id, "request", "LeaveRequest", row.id, `${type.code} ${from}..${to}`)
  refresh()
  return { ok: true }
}

/** Approving puts the person on leave in the roster for each working day, so attendance and exports treat them as on leave. */
export async function decideLeave(id: string, decision: "APPROVED" | "REJECTED", note?: string): Promise<R> {
  const t = await getT()
  const u = await assertPerm("leave.manage")
  const r = await db.leaveRequest.findUnique({ where: { id }, include: { leaveType: true } })
  if (!r || r.status !== "PENDING") return { error: t("lv.err.decided") }
  if (decision === "APPROVED") {
    const from = r.fromDate.toISOString().slice(0, 10)
    const to = r.toDate.toISOString().slice(0, 10)
    const days = await workingDays(r.employeeId, from, to)
    await db.$transaction([
      ...days.map((k) => {
        const date = toDate(k)!
        return db.rosterEntry.upsert({
          where: { employeeId_date: { employeeId: r.employeeId, date } },
          update: { kind: "LEAVE", shiftId: null, note: r.leaveType.name, leaveRequestId: r.id },
          create: { employeeId: r.employeeId, date, kind: "LEAVE", note: r.leaveType.name, leaveRequestId: r.id },
        })
      }),
      db.leaveRequest.update({ where: { id }, data: { status: "APPROVED", days: days.length, decidedBy: u.id, decidedAt: new Date(), decisionNote: note?.trim() || null } }),
    ])
  } else {
    await db.leaveRequest.update({ where: { id }, data: { status: "REJECTED", decidedBy: u.id, decidedAt: new Date(), decisionNote: note?.trim() || null } })
  }
  await audit(u.id, decision.toLowerCase(), "LeaveRequest", id)
  refresh()
  return { ok: true }
}

/** Staff can withdraw their own waiting request; HR can cancel any, which also frees the roster days. */
export async function cancelLeave(id: string): Promise<R> {
  const t = await getT()
  const u = await me()
  const r = await db.leaveRequest.findUnique({ where: { id } })
  if (!r || (r.status !== "PENDING" && r.status !== "APPROVED")) return { error: t("lv.err.decided") }
  if (!can(u, "leave.manage") && (r.employeeId !== u.employeeId || r.status !== "PENDING")) return { error: t("lv.err.decided") }
  await db.$transaction([
    db.rosterEntry.deleteMany({ where: { leaveRequestId: id } }),
    db.leaveRequest.update({ where: { id }, data: { status: "CANCELLED", decidedBy: u.id, decidedAt: new Date() } }),
  ])
  await audit(u.id, "cancel", "LeaveRequest", id)
  refresh()
  return { ok: true }
}

const typeShape = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{1,20}$/, "lv.err.code"),
  name: z.string().trim().min(1, "sch.err.name").max(60),
  isPaid: z.boolean(),
  daysPerYear: z.number().min(0).max(366).nullable(),
  isActive: z.boolean(),
})

export async function saveLeaveType(id: string | null, input: z.input<typeof typeShape>): Promise<R> {
  const t = await getT()
  const u = await assertPerm("leave.manage")
  const p = typeShape.safeParse(input)
  if (!p.success) return { error: t(p.error.issues[0].message) }
  try {
    const row = id ? await db.leaveType.update({ where: { id }, data: p.data }) : await db.leaveType.create({ data: p.data })
    await audit(u.id, id ? "update" : "create", "LeaveType", row.id, row.code)
  } catch {
    return { error: t("lv.err.codeUsed") }
  }
  refresh()
  return { ok: true }
}

/** A per-person yearly allowance that replaces the type's default; empty removes it. */
export async function setEntitlement(employeeId: string, leaveTypeId: string, year: number, days: number | null): Promise<R> {
  const u = await assertPerm("leave.manage")
  if (!Number.isInteger(year) || (days != null && (days < 0 || days > 366))) return { error: "Invalid" }
  if (days == null) await db.leaveEntitlement.deleteMany({ where: { employeeId, leaveTypeId, year } })
  else
    await db.leaveEntitlement.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
      update: { days },
      create: { employeeId, leaveTypeId, year, days },
    })
  await audit(u.id, "entitlement", "Employee", employeeId, `${leaveTypeId} ${year} ${days ?? "default"}`)
  refresh()
  return { ok: true }
}
