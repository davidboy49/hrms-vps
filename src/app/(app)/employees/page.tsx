import Link from "next/link"
import { db } from "@/lib/db"
import { requirePerm, can } from "@/lib/session"
import { buildOrderBy, buildWhere, employeeInclude, lookups, parseFilters, SORTS, type SP } from "@/lib/employees"
import { BASIS_KEY, fmtDate, fmtRate, localDateKey } from "@/lib/format"
import { getLocale, getT, titleOf } from "@/i18n/server"
import { labelFor } from "@/i18n/core"
import { PageHeader } from "@/components/page-header"
import { Toolbar } from "./toolbar"
import { EmployeeTable, type Row } from "./employee-table"

export const generateMetadata = titleOf("nav.employees")
export const dynamic = "force-dynamic"

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const t = await getT()
  const locale = await getLocale()
  const user = await requirePerm("employees.view")
  const sp = await searchParams
  const f = parseFilters(sp)
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""

  const size = [10, 25, 50, 100].includes(Number(one(sp.size))) ? Number(one(sp.size)) : 25
  const sortKey = (SORTS as readonly string[]).includes(one(sp.sort)) ? one(sp.sort) : "employeeNo"
  const dir = one(sp.dir) === "desc" ? "desc" : "asc"
  const where = buildWhere(f)
  // one parallel round for everything that does not depend on the page number
  const [total, lk, activeCount, inactiveCount] = await Promise.all([
    db.employee.count({ where }),
    lookups(),
    db.employee.count({ where: { deletedAt: null, status: { countsAsActive: true } } }),
    db.employee.count({ where: { deletedAt: null, status: { countsAsActive: false } } }),
  ])
  const gone = f.view === "deactivated"
  const pages = Math.max(1, Math.ceil(total / size))
  const page = Math.min(Math.max(1, parseInt(one(sp.page), 10) || 1), pages)
  const emps = await db.employee.findMany({ where, include: { ...employeeInclude, user: { select: { id: true } } }, orderBy: buildOrderBy(sortKey, dir), skip: (page - 1) * size, take: size })

  const canEdit = can(user, "employees.edit")
  // why they left, for the Deactivated list: the latest deactivation of each person on this page
  const events = gone && emps.length ? await db.employmentEvent.findMany({ where: { employeeId: { in: emps.map((e) => e.id) }, kind: "DEACTIVATED" }, orderBy: { createdAt: "desc" } }) : []
  const lastEvent = new Map<string, (typeof events)[number]>()
  for (const ev of events) if (!lastEvent.has(ev.employeeId)) lastEvent.set(ev.employeeId, ev)
  const rows: Row[] = emps.map((e) => ({
    id: e.id,
    employeeNo: e.employeeNo,
    name: locale === "km" && e.nameKm ? e.nameKm : e.nameEn,
    photoUrl: e.photoUrl,
    designation: e.designation.name,
    department: e.department.name,
    joining: fmtDate(e.joiningDate),
    contract: labelFor(t, "contract", e.contractType.code, e.contractType.name),
    contractEnd: e.contractEnd ? fmtDate(e.contractEnd) : null,
    rate: canEdit ? fmtRate(e.rateAmount, e.rateBasis, e.currency, t(BASIS_KEY[e.rateBasis])) : "",
    statusName: labelFor(t, "status", e.status.code, e.status.name),
    statusColor: e.status.color,
    hasLogin: Boolean(e.user),
    leftOn: e.leavingDate ? fmtDate(e.leavingDate) : null,
    note: lastEvent.get(e.id)?.note ?? null,
    by: lastEvent.get(e.id)?.byName ?? null,
  }))
  const optStatus = (xs: typeof lk.statuses) => xs.map((x) => ({ value: x.id, label: labelFor(t, "status", x.code, x.name) }))
  const tab = (view: string, label: string, active: boolean) => (
    <Link href={view === "active" ? "/employees" : `/employees?view=${view}`} className={`rounded-md px-3 py-1.5 text-sm font-medium ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
      {label}
    </Link>
  )
  const opt = (xs: { id: string; name: string }[]) => xs.map((x) => ({ value: x.id, label: x.name }))
  const optCoded = (prefix: string) => (xs: { id: string; name: string; code: string }[]) => xs.map((x) => ({ value: x.id, label: labelFor(t, prefix, x.code, x.name) }))

  return (
    <>
      <PageHeader title={t("nav.employees")} description={t("emp.summary", { all: activeCount + inactiveCount, active: activeCount })} />
      <div className="mb-3 flex gap-2">
        {tab("active", t("emp.tab.active", { n: activeCount }), !gone)}
        {tab("deactivated", t("emp.tab.deactivated", { n: inactiveCount }), gone)}
      </div>
      <div className="space-y-3">
        <Toolbar
          opts={{ departments: opt(lk.departments), designations: opt(lk.designations), contractTypes: optCoded("contract")(lk.contractTypes), statuses: optCoded("status")(lk.statuses.filter((x) => x.countsAsActive === !gone)) }}
          canEdit={canEdit}
          canExport={canEdit}
          canLogins={can(user, "users.createBatch")}
        />
        <EmployeeTable
          rows={rows}
          total={total}
          page={page}
          size={size}
          sort={sortKey}
          dir={dir}
          canEdit={canEdit}
          showRate={canEdit}
          canExport={canEdit}
          view={f.view}
          canDeactivate={can(user, "employees.deactivate")}
          canReactivate={can(user, "employees.reactivate")}
          deactStatuses={optStatus(lk.statuses.filter((x) => !x.countsAsActive))}
          reactStatuses={optStatus(lk.statuses.filter((x) => x.countsAsActive))}
          today={localDateKey(new Date())}
        />
      </div>
    </>
  )
}
