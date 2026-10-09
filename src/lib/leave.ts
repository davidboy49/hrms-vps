import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { loadPlanner, toKey } from "@/lib/schedule"
import { toDate } from "@/lib/format"

const DAY = 86400_000

/** Which half of a day is taken as leave; null means the whole day. */
export type Half = "AM" | "PM" | null

export function keysBetween(fromKey: string, toKey_: string): string[] {
  const from = toDate(fromKey)!.getTime()
  const n = Math.round((toDate(toKey_)!.getTime() - from) / DAY) + 1
  return Array.from({ length: Math.max(0, n) }, (_, i) => toKey(new Date(from + i * DAY)))
}

/** The dates in the range that the person would normally work: days off, holidays and days already on leave are not counted. */
export async function workingDays(employeeId: string, fromKey: string, toKey_: string): Promise<string[]> {
  const keys = keysBetween(fromKey, toKey_)
  if (keys.length === 0) return []
  const plan = await loadPlanner([employeeId], keys[0], keys[keys.length - 1])
  return keys.filter((k) => plan(employeeId, k).kind === "WORK")
}

/**
 * The working days a request covers and how many days it uses. A half day counts 0.5, and only when that day is really a working day
 * (a half day taken on a day off costs nothing). For a one-day request only `firstHalf` applies.
 */
export async function leaveDays(employeeId: string, fromKey: string, toKey_: string, firstHalf: Half, lastHalf: Half) {
  const keys = await workingDays(employeeId, fromKey, toKey_)
  const halves = new Map<string, "AM" | "PM">()
  let days = keys.length
  if (firstHalf && keys[0] === fromKey) {
    halves.set(fromKey, firstHalf)
    days -= 0.5
  }
  if (toKey_ !== fromKey && lastHalf && keys[keys.length - 1] === toKey_) {
    halves.set(toKey_, lastHalf)
    days -= 0.5
  }
  return { keys, days, halves }
}

/**
 * Takes back the roster days an approved leave request had claimed. Whole leave days are removed. A half day sits on a working day
 * that may also carry HR's own shift choice, so only the half is cleared there, and the row is removed only if it holds nothing else.
 */
export async function releaseLeaveEntries(tx: Prisma.TransactionClient, requestIds: string[]) {
  if (requestIds.length === 0) return
  await tx.rosterEntry.deleteMany({ where: { leaveRequestId: { in: requestIds }, kind: "LEAVE" } })
  const halves = await tx.rosterEntry.findMany({ where: { leaveRequestId: { in: requestIds }, kind: "WORK" }, select: { id: true, shiftId: true } })
  const bare = halves.filter((h) => !h.shiftId).map((h) => h.id)
  if (bare.length) await tx.rosterEntry.deleteMany({ where: { id: { in: bare } } })
  const kept = halves.filter((h) => h.shiftId).map((h) => h.id)
  if (kept.length) await tx.rosterEntry.updateMany({ where: { id: { in: kept } }, data: { half: null, leaveRequestId: null } })
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d.getTime())
  const day = x.getUTCDate()
  x.setUTCDate(1)
  x.setUTCMonth(x.getUTCMonth() + n)
  // 31 Jan + 1 month is the end of February, not 3 March
  const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate()
  x.setUTCDate(Math.min(day, last))
  return x
}

/**
 * A new joiner's share of a yearly allowance: the whole months left in the year counting the joining month, except that a joiner
 * after the 15th does not count that month. Rounded to the nearest half day. Someone who joined in an earlier year gets all of it.
 */
export function proRated(quota: number, joined: Date, year: number): number {
  const jy = joined.getUTCFullYear()
  if (jy < year) return quota
  if (jy > year) return 0
  let months = 12 - joined.getUTCMonth()
  if (joined.getUTCDate() > 15) months -= 1
  return Math.round(((quota * Math.max(0, months)) / 12) * 2) / 2
}

export type Balance = {
  typeId: string
  allowance: number | null
  used: number
  pending: number
  /** the allowance is a share of the full year because the person joined this year */
  prorated: boolean
  /** this type cannot start before this date (the waiting period after joining); null when there is none */
  eligibleFrom: string | null
}

/** Allowance, days taken and days waiting for approval, per leave type, for one calendar year, for many people with a few queries. */
export async function balancesFor(employeeIds: string[], year: number): Promise<Map<string, Balance[]>> {
  const start = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year, 11, 31))
  const [types, emps, ents, reqs] = await Promise.all([
    db.leaveType.findMany({ where: { isActive: true } }),
    db.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, joiningDate: true } }),
    db.leaveEntitlement.findMany({ where: { employeeId: { in: employeeIds }, year } }),
    db.leaveRequest.findMany({ where: { employeeId: { in: employeeIds }, status: { in: ["PENDING", "APPROVED"] }, fromDate: { gte: start, lte: end } } }),
  ])
  const out = new Map<string, Balance[]>()
  for (const e of emps) {
    out.set(
      e.id,
      types.map((t) => {
        const own = ents.find((x) => x.employeeId === e.id && x.leaveTypeId === t.id)
        const mine = reqs.filter((r) => r.employeeId === e.id && r.leaveTypeId === t.id)
        // a personal allowance set by HR is used as it is; otherwise the type's yearly allowance, pro-rated for this year's joiners if the type says so
        const share = own || t.daysPerYear == null || !t.proRateNewJoiners ? null : proRated(t.daysPerYear, e.joiningDate, year)
        return {
          typeId: t.id,
          allowance: own ? own.days : share ?? t.daysPerYear,
          used: mine.filter((r) => r.status === "APPROVED").reduce((a, r) => a + r.days, 0),
          pending: mine.filter((r) => r.status === "PENDING").reduce((a, r) => a + r.days, 0),
          prorated: share !== null && share !== t.daysPerYear,
          eligibleFrom: t.waitingMonths > 0 ? toKey(addMonths(e.joiningDate, t.waitingMonths)) : null,
        }
      }),
    )
  }
  return out
}

export async function balances(employeeId: string, year: number): Promise<Balance[]> {
  return (await balancesFor([employeeId], year)).get(employeeId) ?? []
}
