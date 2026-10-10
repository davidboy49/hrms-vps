import { db } from "@/lib/db"
import { localDateKey } from "@/lib/format"
import { keysBetween } from "@/lib/leave"
import { loadPlanner, toKey } from "@/lib/schedule"

export type PayrollRow = {
  id: string
  employeeNo: string
  name: string
  department: string
  rate: number
  rateBasis: string
  currency: string
  /** working days the person was meant to work in the month (a half day of leave counts 0.5) */
  scheduled: number
  /** working days with at least one punch */
  worked: number
  /** working days with no punch and no leave */
  absent: number
  paidLeave: number
  unpaidLeave: number
  /** punched on a day off or a public holiday */
  offDayWork: number
  lateDays: number
  lateMin: number
  /** days with a clock-in but no clock-out (check these before paying) */
  incomplete: number
  otHours: number
  otWeighted: number
  otBy: Record<string, number>
}

export type PayrollInput = {
  month: string
  from: string
  to: string
  /** the last day counted: the current month stops at yesterday */
  through: string
  otTypes: { code: string; name: string; multiplier: number }[]
  rows: PayrollRow[]
}

const round = (n: number) => Math.round(n * 100) / 100

export const isMonthKey = (m: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m)

/**
 * What a payroll person needs for one month, per employee: days worked, absences, paid and unpaid leave, lateness and overtime.
 * Nothing is paid or deducted here; it is the facts the pay is worked out from.
 */
export async function buildPayrollInput(month: string): Promise<PayrollInput> {
  const [y, m] = month.split("-").map(Number)
  const from = `${month}-01`
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  const yesterday = toKey(new Date(Date.parse(localDateKey(new Date()) + "T00:00:00Z") - 86400_000))
  const through = to < yesterday ? to : yesterday
  const fromD = new Date(from + "T00:00:00Z")
  const toD = new Date(to + "T00:00:00Z")

  const emps = await db.employee.findMany({
    where: {
      deletedAt: null,
      joiningDate: { lte: toD },
      OR: [{ status: { countsAsActive: true } }, { leavingDate: { gte: fromD } }],
    },
    orderBy: { employeeNo: "asc" },
    select: { id: true, employeeNo: true, nameEn: true, rateAmount: true, rateBasis: true, currency: true, joiningDate: true, department: { select: { name: true } } },
  })
  const ids = emps.map((e) => e.id)
  const days = through >= from ? keysBetween(from, through) : []

  const [plan, dailies, leaveEntries, otTypes, otRows] = await Promise.all([
    ids.length ? loadPlanner(ids, from, to) : Promise.resolve(null),
    db.attendanceDaily.findMany({ where: { employeeId: { in: ids }, date: { gte: fromD, lte: toD } }, select: { employeeId: true, date: true, firstIn: true, lateMin: true, state: true } }),
    db.rosterEntry.findMany({ where: { employeeId: { in: ids }, date: { gte: fromD, lte: toD }, OR: [{ kind: "LEAVE" }, { half: { not: null } }] }, select: { employeeId: true, date: true, kind: true, leaveRequestId: true } }),
    db.overtimeType.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true, multiplier: true } }),
    db.overtimeRequest.findMany({ where: { employeeId: { in: ids }, status: "APPROVED", date: { gte: fromD, lte: toD } }, select: { employeeId: true, hours: true, overtimeTypeId: true } }),
  ])
  const reqIds = [...new Set(leaveEntries.map((l) => l.leaveRequestId).filter((x): x is string => !!x))]
  const reqs = reqIds.length ? await db.leaveRequest.findMany({ where: { id: { in: reqIds } }, select: { id: true, leaveType: { select: { isPaid: true } } } }) : []
  const paidByReq = new Map(reqs.map((r) => [r.id, r.leaveType.isPaid]))

  const dailyBy = new Map(dailies.map((d) => [`${d.employeeId}|${toKey(d.date)}`, d]))
  const typeById = new Map(otTypes.map((t) => [t.id, t]))
  const rows: PayrollRow[] = emps.map((e) => {
    const r: PayrollRow = {
      id: e.id, employeeNo: e.employeeNo, name: e.nameEn, department: e.department.name,
      rate: Number(e.rateAmount), rateBasis: e.rateBasis, currency: e.currency,
      scheduled: 0, worked: 0, absent: 0, paidLeave: 0, unpaidLeave: 0, offDayWork: 0, lateDays: 0, lateMin: 0, incomplete: 0, otHours: 0, otWeighted: 0, otBy: {},
    }
    const joined = e.joiningDate.toISOString().slice(0, 10)
    for (const k of days) {
      if (k < joined || !plan) continue
      const d = plan(e.id, k)
      const dd = dailyBy.get(`${e.id}|${k}`)
      const punched = Boolean(dd?.firstIn)
      if (d.kind === "WORK") {
        const w = d.half ? 0.5 : 1
        r.scheduled += w
        if (punched) r.worked += w
        else r.absent += w
      } else if ((d.kind === "OFF" || d.kind === "HOLIDAY") && punched) r.offDayWork += 1
      if (dd) {
        if (dd.lateMin > 0) {
          r.lateDays += 1
          r.lateMin += dd.lateMin
        }
        if (dd.state === "INCOMPLETE") r.incomplete += 1
      }
    }
    return r
  })
  const rowBy = new Map(rows.map((r) => [r.id, r]))

  // leave comes from the roster days an approved request created (a day with no request behind it, set by HR, counts as paid)
  for (const l of leaveEntries) {
    const k = toKey(l.date)
    const r = rowBy.get(l.employeeId)
    if (!r || k > through) continue
    const d = l.kind === "LEAVE" ? 1 : 0.5
    const paid = l.leaveRequestId ? (paidByReq.get(l.leaveRequestId) ?? true) : true
    if (paid) r.paidLeave += d
    else r.unpaidLeave += d
  }
  // leave days were never counted as absent or worked above: a LEAVE day has plan kind LEAVE, a half day is already 0.5 of WORK

  for (const o of otRows) {
    const r = rowBy.get(o.employeeId)
    const t = typeById.get(o.overtimeTypeId)
    if (!r || !t) continue
    r.otHours += o.hours
    r.otWeighted += o.hours * t.multiplier
    r.otBy[t.code] = (r.otBy[t.code] ?? 0) + o.hours
  }
  for (const r of rows) {
    r.otHours = round(r.otHours)
    r.otWeighted = round(r.otWeighted)
    for (const k of Object.keys(r.otBy)) r.otBy[k] = round(r.otBy[k])
  }
  return { month, from, to, through, otTypes: otTypes.map((t) => ({ code: t.code, name: t.name, multiplier: t.multiplier })), rows }
}
