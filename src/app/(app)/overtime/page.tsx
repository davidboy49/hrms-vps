import { db } from "@/lib/db"
import { requireUser, can } from "@/lib/session"
import { getT, titleOf } from "@/i18n/server"
import { PageHeader } from "@/components/page-header"
import { OvertimeView } from "./overtime-view"

export const generateMetadata = titleOf("nav.overtime")
export const dynamic = "force-dynamic"

const STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"]

export default async function OvertimePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const t = await getT()
  const user = await requireUser()
  const sp = await searchParams
  const status = STATUSES.includes(sp.status ?? "") ? sp.status! : ""
  const hr = can(user, "overtime.manage")
  const manager = can(user, "overtime.viewAll")

  const me = await db.user.findUnique({ where: { id: user.id }, select: { employeeId: true } })
  const myEmployeeId = me?.employeeId ?? null

  const [types, requests, employees] = await Promise.all([
    db.overtimeType.findMany({ orderBy: { name: "asc" } }),
    db.overtimeRequest.findMany({
      where: { ...(manager ? {} : { employeeId: myEmployeeId ?? "none" }), ...(status ? { status: status as "PENDING" } : {}) },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      include: { employee: { select: { nameEn: true, employeeNo: true } }, overtimeType: { select: { name: true, multiplier: true } } },
    }),
    hr ? db.employee.findMany({ where: { deletedAt: null, status: { countsAsActive: true } }, orderBy: { employeeNo: "asc" }, select: { id: true, employeeNo: true, nameEn: true } }) : Promise.resolve([]),
  ])

  return (
    <>
      <PageHeader title={t("nav.overtime")} description={t("ot.desc")} />
      <OvertimeView
        status={status}
        isHr={hr}
        showEmployee={manager}
        hasEmployee={Boolean(myEmployeeId)}
        types={types.map((x) => ({ id: x.id, code: x.code, name: x.name, multiplier: x.multiplier, isActive: x.isActive }))}
        employees={employees}
        requests={requests.map((r) => ({
          id: r.id,
          employee: `${r.employee.nameEn} (${r.employee.employeeNo})`,
          mine: r.employeeId === myEmployeeId,
          type: `${r.overtimeType.name} ×${r.overtimeType.multiplier}`,
          date: r.date.toISOString().slice(0, 10),
          hours: r.hours,
          reason: r.reason ?? "",
          status: r.status,
          note: r.decisionNote ?? "",
        }))}
      />
    </>
  )
}
