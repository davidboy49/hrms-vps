import { db } from "@/lib/db"
import { requireRole } from "@/lib/session"
import { getT, titleOf } from "@/i18n/server"
import { PageHeader } from "@/components/page-header"
import { TemplatesView } from "./templates-view"

export const generateMetadata = titleOf("att.tab.templates")
export const dynamic = "force-dynamic"

export default async function TemplatesPage() {
  const t = await getT()
  await requireRole("HR")
  const [templates, shifts, employees, depts] = await Promise.all([
    db.scheduleTemplate.findMany({ where: { isPersonal: false }, orderBy: { name: "asc" }, include: { days: true, _count: { select: { employees: true } } } }),
    db.shift.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true, startTime: true, endTime: true, colour: true } }),
    db.employee.findMany({
      where: { deletedAt: null, status: { countsAsActive: true } },
      orderBy: { employeeNo: "asc" },
      select: { id: true, employeeNo: true, nameEn: true, departmentId: true, scheduleTemplateId: true },
    }),
    db.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ])
  return (
    <>
      <PageHeader title={t("att.tab.templates")} description={t("sch.tpl.desc")} />
      <TemplatesView
        shifts={shifts}
        departments={depts}
        employees={employees}
        templates={templates.map((x) => ({
          id: x.id,
          name: x.name,
          count: x._count.employees,
          days: [0, 1, 2, 3, 4, 5, 6].map((wd) => {
            const d = x.days.find((y) => y.weekday === wd)
            return { weekday: wd, kind: (d?.kind ?? "WORK") as "WORK" | "OFF", shiftId: d?.shiftId ?? null }
          }),
        }))}
      />
    </>
  )
}
