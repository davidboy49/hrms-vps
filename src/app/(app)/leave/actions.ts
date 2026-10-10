"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { assertPerm, getSession, can, type SessionUser } from "@/lib/session"
import { audit } from "@/lib/audit"
import { fmtDate, toDate } from "@/lib/format"
import { addMonths, balancesFor, leaveDays, releaseLeaveEntries, type Half } from "@/lib/leave"
import { esc, notifyTelegram, tgText } from "@/lib/telegram"
import { getT } from "@/i18n/server"

type R = { ok?: boolean; error?: string }
const refresh = () => {
  revalidatePath("/leave")
  revalidatePath("/attendance/roster")
}
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const half = z.enum(["AM", "PM"]).nullish().transform((v) => v ?? null)

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
  firstHalf: half,
  lastHalf: half,
})

const fmtDays = (n: number) => String(Math.round(n * 10) / 10)
const dayLabel = (from: string, to: string, firstHalf: Half, lastHalf: Half) =>
  `${fmtDate(from)}${firstHalf ? ` (${firstHalf})` : ""}${to !== from ? ` – ${fmtDate(to)}${lastHalf ? ` (${lastHalf})` : ""}` : ""}`

type Checked =
  | { error: string }
  | { ok: true; employeeId: string; type: { id: string; code: string; name: string }; days: number; firstHalf: Half; lastHalf: Half; left: number | null; from: string; to: string; reason: string | null }

/** Everything a request must satisfy. Used both when the form is sent and for the live preview while it is being filled in. */
async function check(u: SessionUser & { employeeId: string | null }, input: z.input<typeof requestShape>): Promise<Checked> {
  const t = await getT()
  const p = requestShape.safeParse(input)
  if (!p.success) return { error: t("lv.err.invalid") }
  const forOther = can(u, "leave.manage") && Boolean(p.data.employeeId) && p.data.employeeId !== u.employeeId
  if (!forOther && !can(u, "leave.request")) return { error: t("lv.err.noRequestPerm") }
  const employeeId = forOther ? p.data.employeeId! : u.employeeId
  if (!employeeId) return { error: t("lv.err.noEmployee") }
  const { from, to } = p.data
  if (to < from) return { error: t("sch.err.range") }
  const type = await db.leaveType.findUnique({ where: { id: p.data.leaveTypeId } })
  if (!type || !type.isActive) return { error: t("lv.err.invalid") }
  const { firstHalf, lastHalf } = p.data
  if ((firstHalf || lastHalf) && !type.allowHalfDay) return { error: t("lv.err.noHalf", { type: type.name }) }

  // a waiting period after joining (for example no annual leave in the first months); HR can still file an exception
  const emp = await db.employee.findUnique({ where: { id: employeeId }, select: { joiningDate: true } })
  if (!emp) return { error: t("lv.err.invalid") }
  if (type.waitingMonths > 0 && !can(u, "leave.manage")) {
    const eligible = addMonths(emp.joiningDate, type.waitingMonths).toISOString().slice(0, 10)
    if (from < eligible) return { error: t("lv.err.waiting", { type: type.name, date: fmtDate(eligible) }) }
  }

  const { keys, days } = await leaveDays(employeeId, from, to, firstHalf, lastHalf)
  if (keys.length === 0) return { error: t("lv.err.noDays") }
  if (keys.length > 120) return { error: t("sch.err.tooLong") }

  const overlap = await db.leaveRequest.findFirst({
    where: { employeeId, status: { in: ["PENDING", "APPROVED"] }, fromDate: { lte: toDate(to)! }, toDate: { gte: toDate(from)! } },
  })
  if (overlap) return { error: t("lv.err.overlap") }

  const year = Number(from.slice(0, 4))
  const bal = ((await balancesFor([employeeId], year)).get(employeeId) ?? []).find((b) => b.typeId === type.id)
  const left = bal?.allowance == null ? null : bal.allowance - bal.used - bal.pending
  if (left != null && days > left) return { error: t("lv.err.balance", { left: fmtDays(Math.max(0, left)) }) }
  return { ok: true, employeeId, type: { id: type.id, code: type.code, name: type.name }, days, firstHalf, lastHalf, left: left == null ? null : left - days, from, to, reason: p.data.reason || null }
}

/** What a request would use and leave behind, for the live line in the request form. Writes nothing. */
export async function previewLeave(input: z.input<typeof requestShape>): Promise<{ ok: true; days: number; after: number | null } | { error: string }> {
  const c = await check(await me(), input)
  return "error" in c ? c : { ok: true, days: c.days, after: c.left }
}

/** Tells the HR group about a leave request or what happened to it (switch it off in Settings → Notifications). */
function notifyLeave(kind: "Request" | "Approved" | "Rejected" | "Cancelled", id: string, by: string, left?: number | null) {
  after(async () => {
    const r = await db.leaveRequest.findUnique({ where: { id }, include: { employee: { select: { nameEn: true, employeeNo: true } }, leaveType: { select: { name: true } } } })
    if (!r) return
    const from = r.fromDate.toISOString().slice(0, 10)
    const to = r.toDate.toISOString().slice(0, 10)
    const text = await tgText(`tg.msg.leave${kind}`, {
      name: esc(r.employee.nameEn),
      no: r.employee.employeeNo,
      type: esc(r.leaveType.name),
      dates: dayLabel(from, to, r.firstHalf, r.lastHalf),
      days: fmtDays(r.days),
      left: left == null ? "∞" : fmtDays(left),
      by: esc(by),
      reason: r.reason ? `\n“${esc(r.reason)}”` : "",
    })
    await notifyTelegram("leave", text, `leave:${id}:${kind}`)
  })
}

/** Staff ask for their own leave; HR can also file it for someone. */
export async function requestLeave(input: z.input<typeof requestShape>): Promise<R> {
  const u = await me()
  const c = await check(u, input)
  if ("error" in c) return c
  const row = await db.leaveRequest.create({
    data: {
      employeeId: c.employeeId,
      leaveTypeId: c.type.id,
      fromDate: toDate(c.from)!,
      toDate: toDate(c.to)!,
      days: c.days,
      firstHalf: c.firstHalf,
      lastHalf: c.to === c.from ? null : c.lastHalf,
      reason: c.reason,
      requestedBy: u.id,
    },
  })
  await audit(u.id, "request", "LeaveRequest", row.id, `${c.type.code} ${c.from}..${c.to} ${c.days}d`)
  notifyLeave("Request", row.id, u.name, c.left)
  refresh()
  return { ok: true }
}

/** Approving puts the person on leave in the roster for each working day, so attendance and exports treat them as on leave. A half day stays a working day with half of it off. */
export async function decideLeave(id: string, decision: "APPROVED" | "REJECTED", note?: string): Promise<R> {
  const t = await getT()
  const u = await assertPerm("leave.manage")
  const r = await db.leaveRequest.findUnique({ where: { id }, include: { leaveType: true } })
  if (!r || r.status !== "PENDING") return { error: t("lv.err.decided") }
  if (decision === "APPROVED") {
    const from = r.fromDate.toISOString().slice(0, 10)
    const to = r.toDate.toISOString().slice(0, 10)
    const { keys, days, halves } = await leaveDays(r.employeeId, from, to, r.firstHalf, r.lastHalf)
    await db.$transaction([
      ...keys.map((k) => {
        const date = toDate(k)!
        const h = halves.get(k)
        return h
          ? db.rosterEntry.upsert({
              where: { employeeId_date: { employeeId: r.employeeId, date } },
              update: { half: h, note: r.leaveType.name, leaveRequestId: r.id },
              create: { employeeId: r.employeeId, date, kind: "WORK", half: h, note: r.leaveType.name, leaveRequestId: r.id },
            })
          : db.rosterEntry.upsert({
              where: { employeeId_date: { employeeId: r.employeeId, date } },
              update: { kind: "LEAVE", shiftId: null, half: null, note: r.leaveType.name, leaveRequestId: r.id },
              create: { employeeId: r.employeeId, date, kind: "LEAVE", note: r.leaveType.name, leaveRequestId: r.id },
            })
      }),
      db.leaveRequest.update({ where: { id }, data: { status: "APPROVED", days, decidedBy: u.id, decidedAt: new Date(), decisionNote: note?.trim() || null } }),
    ])
  } else {
    await db.leaveRequest.update({ where: { id }, data: { status: "REJECTED", decidedBy: u.id, decidedAt: new Date(), decisionNote: note?.trim() || null } })
  }
  await audit(u.id, decision.toLowerCase(), "LeaveRequest", id)
  notifyLeave(decision === "APPROVED" ? "Approved" : "Rejected", id, u.name)
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
  await db.$transaction(async (tx) => {
    await releaseLeaveEntries(tx, [id])
    await tx.leaveRequest.update({ where: { id }, data: { status: "CANCELLED", decidedBy: u.id, decidedAt: new Date() } })
  })
  await audit(u.id, "cancel", "LeaveRequest", id)
  notifyLeave("Cancelled", id, u.name)
  refresh()
  return { ok: true }
}

const typeShape = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{1,20}$/, "lv.err.code"),
  name: z.string().trim().min(1, "sch.err.name").max(60),
  isPaid: z.boolean(),
  daysPerYear: z.number().min(0).max(366).nullable(),
  isActive: z.boolean(),
  allowHalfDay: z.boolean(),
  proRateNewJoiners: z.boolean(),
  waitingMonths: z.number().int().min(0).max(36),
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
