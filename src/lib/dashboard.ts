import { db } from "@/lib/db"
import { localDateKey } from "@/lib/format"

export type Period = { from: string; to: string; preset: string }

const DAY = 86400_000
const key = (d: Date) => d.toISOString().slice(0, 10)
const utc = (k: string) => new Date(k + "T00:00:00.000Z")
const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)

/** Presets are computed in the app time zone; a custom range comes straight from the URL. */
export function parsePeriod(sp: Record<string, string | string[] | undefined>): Period {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const today = localDateKey(new Date())
  const t = utc(today)
  const first = (y: number, m: number) => key(new Date(Date.UTC(y, m, 1)))
  const preset = one(sp.p) ?? "month"
  if (isDay(one(sp.from)) && isDay(one(sp.to)) && one(sp.from)! <= one(sp.to)!) return { from: one(sp.from)!, to: one(sp.to)!, preset: "custom" }
  switch (preset) {
    case "last": {
      const start = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1))
      return { from: key(start), to: key(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0))), preset }
    }
    case "30":
      return { from: key(new Date(t.getTime() - 29 * DAY)), to: today, preset }
    case "year":
      return { from: first(t.getUTCFullYear(), 0), to: today, preset }
    default:
      return { from: first(t.getUTCFullYear(), t.getUTCMonth()), to: today, preset: "month" }
  }
}

export const SERVICE_BUCKETS = [
  { id: "lt1", min: 0, max: 1 },
  { id: "1-3", min: 1, max: 3 },
  { id: "3-5", min: 3, max: 5 },
  { id: "5-10", min: 5, max: 10 },
  { id: "10+", min: 10, max: null },
] as const

const WORK_DAYS = 26 // working days per month used to turn a daily or hourly rate into a monthly figure
const HOURS = 8

export type DashboardData = {
  period: Period
  activeStatusIds: string[]
  inactiveStatusIds: string[]
  active: number
  total: number
  added: number
  left: number
  presentToday: number
  lateToday: number
  attendance: { date: string; present: number; late: number }[]
  service: { id: string; count: number; joinFrom: string; joinTo: string }[]
  departments: { id: string; name: string; count: number }[]
  payroll: null | {
    currency: string
    total: number
    others: { currency: string; total: number }[]
    byDept: { id: string; name: string; total: number }[]
    employees: number
  }
  ending: { id: string; name: string; photoUrl: string | null; designation: string; contractEnd: string; days: number }[]
  recent: { id: string; name: string; photoUrl: string | null; no: string; department: string; designation: string; joined: string; statusCode: string; statusName: string; statusColor: string; rate: number | null; basis: string; currency: string }[]
}

export async function loadDashboard(period: Period, canSeeRate: boolean): Promise<DashboardData> {
  const from = utc(period.from)
  const to = utc(period.to)
  const today = utc(localDateKey(new Date()))
  const now = new Date()
  const in60 = new Date(now.getTime() + 60 * DAY)
  const live = { deletedAt: null }
  const active = { ...live, status: { countsAsActive: true } }

  const [statuses, activeCount, total, added, left, presentToday, lateToday, perDay, joinDates, byDept, depts, rates, endingRows, recentRows] = await Promise.all([
    db.employeeStatus.findMany({ select: { id: true, countsAsActive: true } }),
    db.employee.count({ where: active }),
    db.employee.count({ where: live }),
    db.employee.count({ where: { ...live, joiningDate: { gte: from, lte: to } } }),
    db.employee.count({ where: { ...live, leavingDate: { gte: from, lte: to } } }),
    db.attendanceDaily.count({ where: { date: today } }),
    db.attendanceDaily.count({ where: { date: today, state: "LATE" } }),
    db.attendanceDaily.groupBy({ by: ["date", "state"], where: { date: { gte: from, lte: to } }, _count: true }),
    db.employee.findMany({ where: active, select: { joiningDate: true } }),
    db.employee.groupBy({ by: ["departmentId"], where: active, _count: true }),
    db.department.findMany({ select: { id: true, name: true } }),
    canSeeRate ? db.employee.findMany({ where: active, select: { rateAmount: true, rateBasis: true, currency: true, departmentId: true } }) : Promise.resolve([]),
    db.employee.findMany({ where: { ...active, contractEnd: { gte: now, lte: in60 } }, orderBy: { contractEnd: "asc" }, take: 8, include: { designation: true } }),
    db.employee.findMany({ where: live, orderBy: { createdAt: "desc" }, take: 8, include: { department: true, designation: true, status: true } }),
  ])

  // attendance per day: everyone with a record counts as present; late is shown on top
  const days = new Map<string, { present: number; late: number }>()
  for (const r of perDay) {
    const k = key(r.date)
    const d = days.get(k) ?? { present: 0, late: 0 }
    d.present += r._count
    if (r.state === "LATE") d.late += r._count
    days.set(k, d)
  }
  const attendance: DashboardData["attendance"] = []
  const span = Math.min(31, Math.round((to.getTime() - from.getTime()) / DAY) + 1)
  for (let i = span - 1; i >= 0; i--) {
    const k = key(new Date(to.getTime() - i * DAY))
    if (new Date(k + "T00:00:00Z").getUTCDay() === 0) continue // Sunday off
    attendance.push({ date: k, ...(days.get(k) ?? { present: 0, late: 0 }) })
  }

  // length of service, with the joining-date range that each bar stands for (used by the click-through filter)
  const todayD = new Date(localDateKey(now) + "T00:00:00Z")
  const yearsAgo = (y: number) => new Date(Date.UTC(todayD.getUTCFullYear() - y, todayD.getUTCMonth(), todayD.getUTCDate()))
  const service = SERVICE_BUCKETS.map((b) => {
    const joinTo = b.min === 0 ? todayD : new Date(yearsAgo(b.min).getTime())
    const joinFrom = b.max === null ? new Date(Date.UTC(1990, 0, 1)) : new Date(yearsAgo(b.max).getTime() + DAY)
    const count = joinDates.filter((e) => e.joiningDate <= joinTo && e.joiningDate >= joinFrom).length
    return { id: b.id, count, joinFrom: key(joinFrom), joinTo: key(joinTo) }
  })

  const nameOf = new Map(depts.map((d) => [d.id, d.name]))
  const departments = byDept.map((d) => ({ id: d.departmentId, name: nameOf.get(d.departmentId) ?? "—", count: d._count })).sort((a, b) => b.count - a.count)

  // payroll estimate: a monthly equivalent of every active rate, for HR and Admin only. It is not a payroll run.
  let payroll: DashboardData["payroll"] = null
  if (canSeeRate) {
    const toMonthly = (amount: number, basis: string) => (basis === "MONTH" ? amount : basis === "DAY" ? amount * WORK_DAYS : amount * HOURS * WORK_DAYS)
    const perCur = new Map<string, number>()
    for (const r of rates) perCur.set(r.currency, (perCur.get(r.currency) ?? 0) + toMonthly(Number(r.rateAmount), r.rateBasis))
    const ranked = [...perCur.entries()].sort((a, b) => b[1] - a[1])
    if (ranked.length) {
      const main = ranked[0][0]
      const deptTotals = new Map<string, number>()
      for (const r of rates) if (r.currency === main) deptTotals.set(r.departmentId, (deptTotals.get(r.departmentId) ?? 0) + toMonthly(Number(r.rateAmount), r.rateBasis))
      payroll = {
        currency: main,
        total: ranked[0][1],
        others: ranked.slice(1).map(([currency, t]) => ({ currency, total: t })),
        byDept: [...deptTotals.entries()].map(([id, t]) => ({ id, name: nameOf.get(id) ?? "—", total: t })).sort((a, b) => b.total - a.total),
        employees: rates.length,
      }
    }
  }

  return {
    period,
    activeStatusIds: statuses.filter((s) => s.countsAsActive).map((s) => s.id),
    inactiveStatusIds: statuses.filter((s) => !s.countsAsActive).map((s) => s.id),
    active: activeCount,
    total,
    added,
    left,
    presentToday,
    lateToday,
    attendance,
    service,
    departments,
    payroll,
    ending: endingRows.map((e) => ({
      id: e.id,
      name: e.nameEn,
      photoUrl: e.photoUrl,
      designation: e.designation.name,
      contractEnd: key(e.contractEnd!),
      days: Math.ceil((e.contractEnd!.getTime() - now.getTime()) / DAY),
    })),
    recent: recentRows.map((e) => ({
      id: e.id,
      name: e.nameEn,
      photoUrl: e.photoUrl,
      no: e.employeeNo,
      department: e.department.name,
      designation: e.designation.name,
      joined: key(e.joiningDate),
      statusCode: e.status.code,
      statusName: e.status.name,
      statusColor: e.status.color,
      rate: canSeeRate ? Number(e.rateAmount) : null,
      basis: e.rateBasis,
      currency: e.currency,
    })),
  }
}
