import { db } from "@/lib/db"
import { loadPlanner, toKey } from "@/lib/schedule"
import { toDate } from "@/lib/format"

const DAY = 86400_000

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

export type Balance = { typeId: string; allowance: number | null; used: number; pending: number }

/** Allowance, days taken and days waiting for approval, per leave type, for one calendar year. */
export async function balances(employeeId: string, year: number): Promise<Balance[]> {
  const start = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year, 11, 31))
  const [types, ents, reqs] = await Promise.all([
    db.leaveType.findMany({ where: { isActive: true } }),
    db.leaveEntitlement.findMany({ where: { employeeId, year } }),
    db.leaveRequest.findMany({ where: { employeeId, status: { in: ["PENDING", "APPROVED"] }, fromDate: { gte: start, lte: end } } }),
  ])
  return types.map((t) => ({
    typeId: t.id,
    allowance: ents.find((e) => e.leaveTypeId === t.id)?.days ?? t.daysPerYear,
    used: reqs.filter((r) => r.leaveTypeId === t.id && r.status === "APPROVED").reduce((a, r) => a + r.days, 0),
    pending: reqs.filter((r) => r.leaveTypeId === t.id && r.status === "PENDING").reduce((a, r) => a + r.days, 0),
  }))
}
