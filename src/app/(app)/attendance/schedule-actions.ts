"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { assertRole } from "@/lib/session"
import { audit } from "@/lib/audit"
import { toDate } from "@/lib/format"
import { getT } from "@/i18n/server"

type R = { ok?: boolean; error?: string; count?: number }

const dayShape = z.object({ weekday: z.number().int().min(0).max(6), kind: z.enum(["WORK", "OFF"]), shiftId: z.string().nullable() })
const templateShape = z.object({ name: z.string().trim().min(1, "sch.err.name").max(80, "sch.err.nameLong"), days: z.array(dayShape).length(7) })

const refresh = () => {
  revalidatePath("/attendance/templates")
  revalidatePath("/attendance/roster")
}

/** Creates or updates a weekly template (a shift or a day off for each weekday). */
export async function saveTemplate(id: string | null, input: z.input<typeof templateShape>): Promise<R> {
  const t = await getT()
  const user = await assertRole("HR")
  const p = templateShape.safeParse(input)
  if (!p.success) return { error: t(p.error.issues[0].message) }
  if (new Set(p.data.days.map((d) => d.weekday)).size !== 7) return { error: t("sch.err.days") }
  if (p.data.days.every((d) => d.kind === "OFF")) return { error: t("sch.err.allOff") }

  const data = p.data
  const rows = data.days.map((d) => ({ weekday: d.weekday, kind: d.kind, shiftId: d.kind === "WORK" ? d.shiftId : null }))
  const saved = await db.$transaction(async (tx) => {
    const tpl = id
      ? await tx.scheduleTemplate.update({ where: { id }, data: { name: data.name } })
      : await tx.scheduleTemplate.create({ data: { name: data.name } })
    await tx.scheduleTemplateDay.deleteMany({ where: { templateId: tpl.id } })
    await tx.scheduleTemplateDay.createMany({ data: rows.map((r) => ({ ...r, templateId: tpl.id })) })
    return tpl
  })
  await audit(user.id, id ? "update" : "create", "ScheduleTemplate", saved.id, data.name)
  refresh()
  return { ok: true }
}

export async function deleteTemplate(id: string): Promise<R> {
  const user = await assertRole("HR")
  const tpl = await db.scheduleTemplate.findUnique({ where: { id }, include: { _count: { select: { employees: true } } } })
  if (!tpl) return { ok: true }
  // people on it fall back to the default week (Sunday off)
  await db.scheduleTemplate.delete({ where: { id } })
  await audit(user.id, "delete", "ScheduleTemplate", id, `${tpl.name} (${tpl._count.employees} employees)`)
  refresh()
  return { ok: true, count: tpl._count.employees }
}

/** Puts the listed employees on a template (or back on the default week when templateId is null). */
export async function assignTemplate(templateId: string | null, employeeIds: string[]): Promise<R> {
  const user = await assertRole("HR")
  if (employeeIds.length === 0) return { ok: true, count: 0 }
  if (employeeIds.length > 2000) return { error: "Too many employees" }
  const r = await db.employee.updateMany({ where: { id: { in: employeeIds }, deletedAt: null }, data: { scheduleTemplateId: templateId } })
  await audit(user.id, "assign", "ScheduleTemplate", templateId ?? undefined, `${r.count} employee(s)`)
  refresh()
  return { ok: true, count: r.count }
}

const rosterShape = z.object({
  employeeId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // "default" removes the change; "OFF" and "LEAVE" mark the day; "WORK" or "SHIFT:<id>" work a specific shift
  value: z.string().regex(/^(default|OFF|LEAVE|WORK|SHIFT:[A-Za-z0-9]+)$/),
  note: z.string().trim().max(200).optional(),
})

/** Changes one employee's plan for a date or a run of dates, such as a holiday trip or a swapped shift. */
export async function setRoster(input: z.input<typeof rosterShape>): Promise<R> {
  const t = await getT()
  const user = await assertRole("HR")
  const p = rosterShape.safeParse(input)
  if (!p.success) return { error: t("sch.err.invalid") }
  const { employeeId, value, note } = p.data
  const from = toDate(p.data.from)!
  const to = toDate(p.data.to)!
  if (to < from) return { error: t("sch.err.range") }
  const days = Math.round((to.getTime() - from.getTime()) / 86400_000) + 1
  if (days > 62) return { error: t("sch.err.tooLong") }

  if (value === "default") {
    await db.rosterEntry.deleteMany({ where: { employeeId, date: { gte: from, lte: to } } })
  } else {
    let shiftId: string | null = null
    if (value.startsWith("SHIFT:")) {
      shiftId = value.slice(6)
      if (!(await db.shift.findUnique({ where: { id: shiftId } }))) return { error: t("sch.err.shift") }
    }
    const kind = value === "OFF" ? "OFF" : value === "LEAVE" ? "LEAVE" : "WORK"
    const dates = Array.from({ length: days }, (_, i) => new Date(from.getTime() + i * 86400_000))
    await db.$transaction(
      dates.map((date) =>
        db.rosterEntry.upsert({
          where: { employeeId_date: { employeeId, date } },
          update: { kind, shiftId, note: note || null },
          create: { employeeId, date, kind, shiftId, note: note || null },
        }),
      ),
    )
  }
  await audit(user.id, "roster", "Employee", employeeId, `${value} ${p.data.from}..${p.data.to}`)
  refresh()
  return { ok: true, count: days }
}

/**
 * Sets one employee's weekly days off (for example Saturday and Sunday), keeping the shifts they already work.
 * This gives them their own private template, so other people on a shared template are not affected.
 */
export async function setWeeklyOff(employeeId: string, offDays: number[]): Promise<R> {
  const t = await getT()
  const user = await assertRole("HR")
  const off = new Set(offDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))
  if (off.size >= 7) return { error: t("sch.err.allOff") }

  const emp = await db.employee.findUnique({ where: { id: employeeId }, include: { scheduleTemplate: { include: { days: true } } } })
  if (!emp || emp.deletedAt) return { error: t("sch.err.invalid") }
  const oldDays = new Map((emp.scheduleTemplate?.days ?? []).map((d) => [d.weekday, d.shiftId]))
  const rows = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, kind: off.has(weekday) ? ("OFF" as const) : ("WORK" as const), shiftId: off.has(weekday) ? null : (oldDays.get(weekday) ?? null) }))

  await db.$transaction(async (tx) => {
    let tplId = emp.scheduleTemplate?.isPersonal ? emp.scheduleTemplate.id : null
    if (!tplId) {
      const created = await tx.scheduleTemplate.create({ data: { name: `Personal · ${emp.employeeNo}`, isPersonal: true } })
      tplId = created.id
      await tx.employee.update({ where: { id: emp.id }, data: { scheduleTemplateId: tplId } })
    }
    await tx.scheduleTemplateDay.deleteMany({ where: { templateId: tplId } })
    await tx.scheduleTemplateDay.createMany({ data: rows.map((r) => ({ ...r, templateId: tplId! })) })
  })
  await audit(user.id, "weekly-off", "Employee", employeeId, [...off].sort().join(","))
  refresh()
  return { ok: true }
}
