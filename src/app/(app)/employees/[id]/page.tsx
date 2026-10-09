import Link from "next/link"
import { notFound } from "next/navigation"
import { Pencil } from "lucide-react"
import { db } from "@/lib/db"
import { requirePerm, can } from "@/lib/session"
import { BASIS_KEY, fmtDate, fmtRate, fmtTime, localDateKey } from "@/lib/format"
import { lookups } from "@/lib/employees"
import { getT, titleOf } from "@/i18n/server"
import { labelFor, type TFn } from "@/i18n/core"
import { Button } from "@/components/ui/button"
import { PersonAvatar } from "@/components/avatar"
import { StatusBadge } from "@/components/status-badge"
import { StatusButton } from "../status-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export const dynamic = "force-dynamic"

function tenure(from: Date, t: TFn) {
  const months = Math.max(0, Math.floor((Date.now() - from.getTime()) / (30.44 * 864e5)))
  const y = Math.floor(months / 12)
  const m = months % 12
  return [y ? t("tenure.years", { n: y }) : "", m || !y ? t("tenure.months", { n: m }) : ""].filter(Boolean).join(" ")
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children || "—"}</dd>
    </div>
  )
}

export const generateMetadata = titleOf("nav.employees")

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT()
  const user = await requirePerm("employees.view")
  const { id } = await params
  const e = await db.employee.findFirst({
    where: { id, deletedAt: null },
    include: { department: true, designation: true, contractType: true, status: true, location: true, shift: true, scheduleTemplate: { include: { days: true } }, user: { select: { id: true } } },
  })
  if (!e) notFound()
  const canEdit = can(user, "employees.edit")
  const inactive = !e.status.countsAsActive
  const canToggle = inactive ? can(user, "employees.reactivate") : can(user, "employees.deactivate")
  const [history, transfers, daily, events, lk] = await Promise.all([
    canEdit ? db.rateHistory.findMany({ where: { employeeId: id }, orderBy: { effectiveFrom: "desc" }, take: 10 }) : Promise.resolve([]),
    canEdit ? db.branchTransfer.findMany({ where: { employeeId: id }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }], take: 10 }) : Promise.resolve([]),
    db.attendanceDaily.findMany({ where: { employeeId: id }, orderBy: { date: "desc" }, take: 14 }),
    canEdit ? db.employmentEvent.findMany({ where: { employeeId: id }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
    canToggle ? lookups() : Promise.resolve(null),
  ])
  const toggleStatuses = (lk?.statuses ?? []).filter((x) => x.countsAsActive === inactive).map((x) => ({ value: x.id, label: labelFor(t, "status", x.code, x.name) }))
  // eslint-disable-next-line react-hooks/purity
  const expiring = e.contractEnd && e.contractEnd.getTime() - Date.now() < 60 * 864e5

  return (
    <div className="max-w-5xl space-y-6">
      <div className="text-sm text-muted-foreground">
        <Link href="/employees" className="hover:underline">
          {t("nav.employees")}
        </Link>{" "}
        › {e.employeeNo}
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <PersonAvatar name={e.nameEn} url={e.photoUrl} className="size-20 text-xl" />
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {e.nameEn} {e.nameKm && <span className="font-normal text-muted-foreground">· {e.nameKm}</span>}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge name={labelFor(t, "status", e.status.code, e.status.name)} color={e.status.color} />
            <span>
              {e.designation.name} · {e.department.name}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("profile.joined", { no: e.employeeNo, date: fmtDate(e.joiningDate), tenure: tenure(e.joiningDate, t) })}
          </p>
        </div>
        {canToggle && toggleStatuses.length > 0 && (
          <StatusButton mode={inactive ? "reactivate" : "deactivate"} who={{ id: e.id, name: e.nameEn, no: e.employeeNo, hasLogin: Boolean(e.user) }} statuses={toggleStatuses} today={localDateKey(new Date())} />
        )}
        {canEdit && (
          <Button render={<Link href={`/employees/${e.id}/edit`} />}>
            <Pencil /> {t("common.edit")}
          </Button>
        )}
      </div>
      {inactive && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">{t("emp.banner.inactive", { date: e.leavingDate ? fmtDate(e.leavingDate) : "—" })}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">{t("form.personal")}</h2>
          <dl className="grid grid-cols-2 gap-4">
            <Item label={t("form.gender")}>{e.gender ? t(`gender.${e.gender}`) : ""}</Item>
            <Item label={t("form.dob")}>{e.dob ? fmtDate(e.dob) : ""}</Item>
            <Item label={t("form.phone")}>{e.phone}</Item>
            <Item label={t("form.email")}>{e.email}</Item>
            <Item label={t("form.nationalId")}>{e.nationalId}</Item>
            <Item label={t("form.address")}>{e.address}</Item>
          </dl>
        </section>
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">{t("profile.jobContract")}</h2>
          <dl className="grid grid-cols-2 gap-4">
            <Item label={t("emp.contract")}>{labelFor(t, "contract", e.contractType.code, e.contractType.name)}</Item>
            <Item label={t("form.contractEnd")}>
              {e.contractEnd ? (
                <span className={expiring ? "font-medium text-amber-600 dark:text-amber-400" : ""}>
                  {fmtDate(e.contractEnd)}
                  {expiring ? ` · ${t("profile.endingSoon")}` : ""}
                </span>
              ) : (
                ""
              )}
            </Item>
            {canEdit && <Item label={t("emp.rate")}>{fmtRate(e.rateAmount, e.rateBasis, e.currency, t(BASIS_KEY[e.rateBasis]))}</Item>}
            {e.leavingDate && <Item label={t("form.leavingDate")}>{fmtDate(e.leavingDate)}</Item>}
            <Item label={t("form.location")}>{e.location?.name}</Item>
            <Item label={t("form.weeklyOff")}>
              {(e.scheduleTemplate ? e.scheduleTemplate.days.filter((d) => d.kind === "OFF").map((d) => d.weekday) : [0])
                .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
                .map((d) => t(`wd.${d}`))
                .join(", ") || t("sch.noDayOff")}
              {e.scheduleTemplate && !e.scheduleTemplate.isPersonal ? ` · ${e.scheduleTemplate.name}` : ""}
            </Item>
            <Item label={t("form.shift")}>{e.shift ? `${e.shift.name} (${e.shift.startTime}–${e.shift.endTime})` : ""}</Item>
            <Item label={t("form.zkPin")}>
              <span className="font-mono">{e.zkPin}</span>
            </Item>
          </dl>
        </section>
      </div>

      {canEdit && events.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">{t("emp.hist.title")}</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("profile.effective")}</TableHead>
                  <TableHead>{t("emp.hist.what")}</TableHead>
                  <TableHead>{t("emp.hist.note")}</TableHead>
                  <TableHead>{t("profile.changedBy")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="whitespace-nowrap">{fmtDate(ev.effectiveDate)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {t(ev.kind === "DEACTIVATED" ? "emp.hist.deactivated" : "emp.hist.reactivated")}: {ev.fromStatus} → {ev.toStatus}
                    </TableCell>
                    <TableCell className="max-w-96 whitespace-pre-wrap">{ev.note}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{ev.byName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {canEdit && history.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">{t("profile.rateHistory")}</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("profile.effective")}</TableHead>
                  <TableHead className="text-right">{t("emp.rate")}</TableHead>
                  <TableHead>{t("profile.changedBy")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{fmtDate(h.effectiveFrom)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtRate(h.amount, h.basis, h.currency, t(BASIS_KEY[h.basis]))}</TableCell>
                    <TableCell className="text-muted-foreground">{h.changedBy ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {canEdit && transfers.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">{t("profile.branchHistory")}</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("profile.effective")}</TableHead>
                  <TableHead>{t("profile.from")}</TableHead>
                  <TableHead>{t("profile.to")}</TableHead>
                  <TableHead>{t("profile.changedBy")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{fmtDate(h.effectiveFrom)}</TableCell>
                    <TableCell>{h.fromName ?? "—"}</TableCell>
                    <TableCell>{h.toName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{h.changedBy ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("profile.recentAtt")}</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("att.in")}</TableHead>
                <TableHead>{t("att.out")}</TableHead>
                <TableHead className="text-right">{t("att.worked")}</TableHead>
                <TableHead>{t("att.state")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daily.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                    {t("profile.noAtt")}
                  </TableCell>
                </TableRow>
              )}
              {daily.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{fmtDate(d.date)}</TableCell>
                  <TableCell className="tabular-nums">{fmtTime(d.firstIn)}</TableCell>
                  <TableCell className="tabular-nums">{fmtTime(d.lastOut)}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.workedMin ? t("time.hm", { h: Math.floor(d.workedMin / 60), m: d.workedMin % 60 }) : "—"}</TableCell>
                  <TableCell>{d.state === "LATE" ? t("att.lateBy", { m: d.lateMin }) : t(`daily.${d.state}`)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
