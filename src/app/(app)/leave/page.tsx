import { db } from "@/lib/db"
import { requireUser, can } from "@/lib/session"
import { balances } from "@/lib/leave"
import { localDateKey } from "@/lib/format"
import { getT, titleOf } from "@/i18n/server"
import { PageHeader } from "@/components/page-header"
import { LeaveView } from "./leave-view"

export const generateMetadata = titleOf("nav.leave")
export const dynamic = "force-dynamic"

const STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"]

export default async function LeavePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const t = await getT()
  const user = await requireUser()
  const sp = await searchParams
  const status = STATUSES.includes(sp.status ?? "") ? sp.status! : ""
  const hr = can(user, "leave.manage")
  const manager = can(user, "leave.viewAll")
  const year = Number(localDateKey(new Date()).slice(0, 4))

  const me = await db.user.findUnique({ where: { id: user.id }, select: { employeeId: true } })
  const myEmployeeId = me?.employeeId ?? null

  const [types, requests, mine, employees, ents] = await Promise.all([
    db.leaveType.findMany({ orderBy: { name: "asc" } }),
    db.leaveRequest.findMany({
      where: { ...(manager ? {} : { employeeId: myEmployeeId ?? "none" }), ...(status ? { status: status as "PENDING" } : {}) },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      include: { employee: { select: { nameEn: true, employeeNo: true } }, leaveType: { select: { name: true } } },
    }),
    myEmployeeId ? balances(myEmployeeId, year) : Promise.resolve([]),
    hr ? db.employee.findMany({ where: { deletedAt: null, status: { countsAsActive: true } }, orderBy: { employeeNo: "asc" }, select: { id: true, employeeNo: true, nameEn: true } }) : Promise.resolve([]),
    hr ? db.leaveEntitlement.findMany({ where: { year } }) : Promise.resolve([]),
  ])

  return (
    <>
      <PageHeader title={t("nav.leave")} description={t("lv.desc")} />
      <LeaveView
        year={year}
        status={status}
        canDecide={hr}
        isHr={hr}
        showEmployee={manager}
        hasEmployee={Boolean(myEmployeeId)}
        types={types.map((x) => ({ id: x.id, code: x.code, name: x.name, isPaid: x.isPaid, daysPerYear: x.daysPerYear, isActive: x.isActive }))}
        balances={mine}
        employees={employees}
        entitlements={ents.map((e) => ({ employeeId: e.employeeId, leaveTypeId: e.leaveTypeId, days: e.days }))}
        requests={requests.map((r) => ({
          id: r.id,
          employee: `${r.employee.nameEn} (${r.employee.employeeNo})`,
          mine: r.employeeId === myEmployeeId,
          type: r.leaveType.name,
          from: r.fromDate.toISOString().slice(0, 10),
          to: r.toDate.toISOString().slice(0, 10),
          days: r.days,
          reason: r.reason ?? "",
          status: r.status,
          note: r.decisionNote ?? "",
        }))}
      />
    </>
  )
}
