import { db } from "@/lib/db"

export type ShiftLite = { id: string; code: string; name: string; startTime: string; endTime: string; graceMin: number; colour: string }

export type DayPlan = {
  kind: "WORK" | "OFF" | "HOLIDAY" | "LEAVE"
  /** the shift to work, for WORK days (null when the person has no shift at all) */
  shift: ShiftLite | null
  /** where the answer came from: a one-day change, a holiday, the weekly template, or the default (Sunday off) */
  source: "roster" | "holiday" | "template" | "default"
  holidayName?: string
  note?: string | null
  /** WORK days only: half of the day is approved leave, so the person works just the other half */
  half?: "AM" | "PM"
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

/**
 * When the person is expected to be at work, in minutes after midnight. On a half-day leave the shift is cut at its middle:
 * morning leave means starting at the middle, afternoon leave means finishing at the middle. Nobody is "late" for the half they are off.
 */
export function workWindow(shift: { startTime: string; endTime: string }, half?: "AM" | "PM"): { start: number; end: number } {
  const start = minutes(shift.startTime)
  const end = minutes(shift.endTime)
  const mid = Math.round((start + end) / 2)
  if (half === "AM") return { start: mid, end }
  if (half === "PM") return { start, end: mid }
  return { start, end }
}

/** 0 = Sunday ... 6 = Saturday for a yyyy-mm-dd key */
export const weekdayOf = (key: string) => new Date(key + "T00:00:00.000Z").getUTCDay()

export const toKey = (d: Date) => d.toISOString().slice(0, 10)

export type Planner = (employeeId: string, dateKey: string) => DayPlan

/**
 * Loads everything needed to answer "what is this person's plan on this date?" for many people and many days at once.
 *
 * Order of precedence, strongest first:
 *   1. a one-day roster change (shift, day off or leave)
 *   2. a company holiday
 *   3. the person's weekly template (a shift or a day off for each weekday)
 *   4. the default: Sunday off, every other day the person's own shift
 */
export async function loadPlanner(employeeIds: string[], fromKey: string, toKey_: string): Promise<Planner> {
  const from = new Date(fromKey + "T00:00:00.000Z")
  const to = new Date(toKey_ + "T00:00:00.000Z")
  const [emps, shifts, roster, holidays] = await Promise.all([
    db.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, shiftId: true, scheduleTemplateId: true } }),
    db.shift.findMany({ select: { id: true, code: true, name: true, startTime: true, endTime: true, graceMin: true, colour: true } }),
    db.rosterEntry.findMany({ where: { employeeId: { in: employeeIds }, date: { gte: from, lte: to } } }),
    db.holiday.findMany({ where: { isActive: true, date: { gte: from, lte: to } }, select: { date: true, name: true } }),
  ])
  const templateIds = [...new Set(emps.map((e) => e.scheduleTemplateId).filter((x): x is string => !!x))]
  const templates = templateIds.length ? await db.scheduleTemplate.findMany({ where: { id: { in: templateIds } }, include: { days: true } }) : []

  const shiftById = new Map(shifts.map((s) => [s.id, s]))
  const empById = new Map(emps.map((e) => [e.id, e]))
  const tplById = new Map(templates.map((t) => [t.id, t]))
  const rosterBy = new Map(roster.map((r) => [`${r.employeeId}|${toKey(r.date)}`, r]))
  const holidayBy = new Map(holidays.map((h) => [toKey(h.date), h.name]))

  return (employeeId, dateKey) => {
    const e = empById.get(employeeId)
    const own = e?.shiftId ? (shiftById.get(e.shiftId) ?? null) : null

    const r = rosterBy.get(`${employeeId}|${dateKey}`)
    if (r) {
      if (r.kind === "OFF") return { kind: "OFF", shift: null, source: "roster", note: r.note }
      if (r.kind === "LEAVE") return { kind: "LEAVE", shift: null, source: "roster", note: r.note }
      return { kind: "WORK", shift: (r.shiftId ? shiftById.get(r.shiftId) : null) ?? own, source: "roster", note: r.note, ...(r.half ? { half: r.half } : {}) }
    }

    const hol = holidayBy.get(dateKey)
    if (hol) return { kind: "HOLIDAY", shift: null, source: "holiday", holidayName: hol }

    const tpl = e?.scheduleTemplateId ? tplById.get(e.scheduleTemplateId) : undefined
    if (tpl) {
      const day = tpl.days.find((d) => d.weekday === weekdayOf(dateKey))
      if (day?.kind === "OFF") return { kind: "OFF", shift: null, source: "template" }
      if (day) return { kind: "WORK", shift: (day.shiftId ? shiftById.get(day.shiftId) : null) ?? own, source: "template" }
    }

    return weekdayOf(dateKey) === 0 ? { kind: "OFF", shift: null, source: "default" } : { kind: "WORK", shift: own, source: "default" }
  }
}

/** Convenience for a single employee and day. */
export async function planFor(employeeId: string, dateKey: string): Promise<DayPlan> {
  return (await loadPlanner([employeeId], dateKey, dateKey))(employeeId, dateKey)
}
