import { db } from "@/lib/db"
import { requirePerm, can } from "@/lib/session"
import { loadPlanner, weekdayOf } from "@/lib/schedule"
import { localDateKey } from "@/lib/format"
import { getT, titleOf } from "@/i18n/server"
import { PageHeader } from "@/components/page-header"
import { RosterGrid, type RosterRow } from "./roster-grid"

export const generateMetadata = titleOf("att.tab.roster")
export const dynamic = "force-dynamic"

type SP = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""

export default async function RosterPage({ searchParams }: { searchParams: Promise<SP> }) {
  const t = await getT()
  const user = await requirePerm("roster.view")
  const sp = await searchParams
  const canEdit = can(user, "roster.edit")

  const today = localDateKey(new Date())
  const month = /^\d{4}-\d{2}$/.test(one(sp.m)) ? one(sp.m) : today.slice(0, 7)
  const [y, m] = month.split("-").map(Number)
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const keys = Array.from({ length: dim }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7)
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7)

  const size = [10, 25, 50, 100].includes(Number(one(sp.size))) ? Number(one(sp.size)) : 25
  const q = one(sp.q).trim()
  const dept = one(sp.dept)
  const where = {
    deletedAt: null,
    status: { countsAsActive: true },
    ...(dept ? { departmentId: dept } : {}),
    ...(q ? { OR: [{ nameEn: { contains: q, mode: "insensitive" as const } }, { employeeNo: { contains: q, mode: "insensitive" as const } }] } : {}),
  }
  const total = await db.employee.count({ where })
  const pages = Math.max(1, Math.ceil(total / size))
  const page = Math.min(Math.max(1, parseInt(one(sp.page), 10) || 1), pages)

  const [emps, shifts, templates, depts, holidays] = await Promise.all([
    db.employee.findMany({
      where,
      orderBy: { employeeNo: "asc" },
      skip: (page - 1) * size,
      take: size,
      include: { designation: true, scheduleTemplate: { include: { days: true } } },
    }),
    db.shift.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true, startTime: true, endTime: true, colour: true } }),
    db.scheduleTemplate.findMany({ where: { isPersonal: false, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.holiday.findMany({ where: { isActive: true, date: { gte: new Date(keys[0] + "T00:00:00Z"), lte: new Date(keys[dim - 1] + "T00:00:00Z") } }, select: { date: true, name: true } }),
  ])
  const plan = await loadPlanner(emps.map((e) => e.id), keys[0], keys[dim - 1])

  const rows: RosterRow[] = emps.map((e) => ({
    id: e.id,
    name: e.nameEn,
    no: e.employeeNo,
    designation: e.designation.name,
    templateId: e.scheduleTemplate && !e.scheduleTemplate.isPersonal ? e.scheduleTemplate.id : null,
    personal: Boolean(e.scheduleTemplate?.isPersonal),
    // weekly days off, for the "weekly pattern" dialog: the template's off days, or Sunday by default
    weeklyOff: e.scheduleTemplate ? e.scheduleTemplate.days.filter((d) => d.kind === "OFF").map((d) => d.weekday) : [0],
    cells: keys.map((k) => {
      const p = plan(e.id, k)
      return { k: p.kind, code: p.shift?.code ?? "", colour: p.shift?.colour ?? "blue", src: p.source, note: p.note ?? p.holidayName ?? "" }
    }),
  }))

  return (
    <>
      <PageHeader title={t("att.tab.roster")} description={t("sch.roster.desc")} />
      <RosterGrid
        month={month}
        prev={prev}
        next={next}
        thisMonth={today.slice(0, 7)}
        days={keys.map((k) => ({ key: k, num: Number(k.slice(8)), dow: weekdayOf(k) }))}
        holidays={Object.fromEntries(holidays.map((h) => [h.date.toISOString().slice(0, 10), h.name]))}
        rows={rows}
        shifts={shifts}
        templates={templates}
        departments={depts}
        total={total}
        page={page}
        size={size}
        canEdit={canEdit}
        today={today}
      />
    </>
  )
}
