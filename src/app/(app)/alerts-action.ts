"use server"

import { db } from "@/lib/db"
import { assertPerm, can } from "@/lib/session"

export type Alert = { key: string; count: number; href: string }

/** Things that need someone's attention. Counts only, so it is cheap enough to ask on every page load. */
export async function getAlerts(): Promise<Alert[]> {
  const user = await assertPerm("alerts.view")
  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 86400_000)
  const week = new Date(now.getTime() - 7 * 86400_000)
  const [ending, incomplete, unknown] = await Promise.all([
    db.employee.count({ where: { deletedAt: null, status: { countsAsActive: true }, contractEnd: { gte: now, lte: in30 } } }),
    db.attendanceDaily.count({ where: { state: "INCOMPLETE", date: { gte: week } } }),
    can(user, "attendance.manage") ? db.attendancePunch.count({ where: { employeeId: null } }) : Promise.resolve(0),
  ])
  const out: Alert[] = []
  if (ending) out.push({ key: "alert.ending", count: ending, href: "/" })
  if (incomplete) out.push({ key: "alert.incomplete", count: incomplete, href: "/attendance?tab=daily" })
  if (unknown) out.push({ key: "alert.unknown", count: unknown, href: "/attendance?match=unknown" })
  return out
}
