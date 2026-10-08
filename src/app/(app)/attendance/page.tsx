import Link from "next/link"
import { QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/db"
import { requirePerm, can } from "@/lib/session"
import { fmtDate, fmtDateTime, fmtTime, fromLocal, localDateKey } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { DeviceCards, SyncAllButton, type DeviceView } from "./device-cards"
import { PunchToolbar } from "./punch-toolbar"
import { getT, titleOf } from "@/i18n/server"
import type { TFn } from "@/i18n/core"
import { Pager } from "@/components/pager"
import { buildPunchWhere, parsePunchFilters } from "@/lib/punches"

export const generateMetadata = titleOf("nav.attendance")
export const dynamic = "force-dynamic"

type SP = Record<string, string | string[] | undefined>

const pill = (tone: "ok" | "warn" | "bad" | "mute", text: string) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
      tone === "ok" && "bg-green-500/15 text-green-700 dark:text-green-300",
      tone === "warn" && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      tone === "bad" && "bg-red-500/15 text-red-700 dark:text-red-300",
      tone === "mute" && "bg-muted text-muted-foreground",
    )}
  >
    <span className="size-1.5 rounded-full bg-current" />
    {text}
  </span>
)

export default async function AttendancePage({ searchParams }: { searchParams: Promise<SP> }) {
  const t = await getT()
  const user = await requirePerm("attendance.view")
  const sp = await searchParams
  const tab = sp.tab === "daily" || sp.tab === "devices" ? sp.tab : "punches"
  const canEdit = can(user, "attendance.manage")
  const isAdmin = can(user, "attendance.devices")
  const today = localDateKey(new Date())


  return (
    <>
      <PageHeader
        title={t(`att.tab.${tab}`)}
        description={t("att.desc")}
        actions={
          canEdit ? (
            <>
              <Button variant="outline" render={<Link href="/attendance/qr" />}>
                <QrCode /> {t("att.qr")}
              </Button>
              {tab !== "daily" && <SyncAllButton />}
            </>
          ) : undefined
        }
      />

      {tab === "devices" && <Devices canEdit={canEdit} isAdmin={isAdmin} today={today} />}
      {tab === "punches" && <Punches sp={sp} canExport={canEdit} />}
      {tab === "daily" && <Daily date={typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today} />}
    </>
  )
}

function syncMessage(m: string, t: TFn) {
  if (m.startsWith("unknown:")) return t("sync.unknown", { n: m.slice(8) })
  if (m === "push") return t("sync.push")
  if (m.startsWith("dev.")) return t(m)
  return m
}

async function Devices({ canEdit, isAdmin, today }: { canEdit: boolean; isAdmin: boolean; today: string }) {
  const t = await getT()
  const start = fromLocal(today, "00:00")
  const [devices, locations, logs, userCounts, todayCounts] = await Promise.all([
    db.device.findMany({ orderBy: { name: "asc" } }),
    db.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.syncLog.findMany({ orderBy: { startedAt: "desc" }, take: 12, include: { device: true } }),
    db.employee.groupBy({ by: ["locationId"], where: { deletedAt: null, zkPin: { not: null } }, _count: true }),
    db.attendancePunch.groupBy({ by: ["deviceId"], where: { punchedAt: { gte: start } }, _count: true }),
  ])
  const view: DeviceView[] = devices.map((d) => ({
    id: d.id,
    name: d.name,
    model: d.model,
    ip: d.ip,
    port: d.port,
    serialNo: d.serialNo,
    mode: d.mode,
    status: d.status,
    locationId: d.locationId,
    lastSync: d.lastSyncAt ? fmtDateTime(d.lastSyncAt) : t("att.never"),
    todayPunches: todayCounts.find((c) => c.deviceId === d.id)?._count ?? 0,
    users: userCounts.find((c) => c.locationId === d.locationId)?._count ?? 0,
  }))
  return (
    <div className="space-y-6">
      <DeviceCards devices={view} locations={locations.map((l) => ({ id: l.id, name: l.name }))} canEdit={canEdit} isAdmin={isAdmin} />
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("att.syncLog")}</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("att.started")}</TableHead>
                <TableHead>{t("att.device")}</TableHead>
                <TableHead className="text-right">{t("att.newRecords")}</TableHead>
                <TableHead>{t("att.result")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                    {t("att.noSyncs")}
                  </TableCell>
                </TableRow>
              )}
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="tabular-nums">{fmtDateTime(l.startedAt)}</TableCell>
                  <TableCell>{l.device.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.records}</TableCell>
                  <TableCell>
                    {l.ok ? pill("ok", t("att.success")) : pill("bad", t("att.failed"))} {l.message && <span className="ml-1 text-xs text-muted-foreground">{syncMessage(l.message, t)}</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}

async function Punches({ sp, canExport }: { sp: SP; canExport: boolean }) {
  const t = await getT()
  const f = parsePunchFilters(sp)
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""
  const size = [10, 25, 50, 100].includes(Number(one(sp.size))) ? Number(one(sp.size)) : 25
  const where = buildPunchWhere(f)
  const [total, devices, departments, unknownCount] = await Promise.all([
    db.attendancePunch.count({ where }),
    db.device.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.attendancePunch.count({ where: { employeeId: null } }),
  ])
  const pages = Math.max(1, Math.ceil(total / size))
  const page = Math.min(Math.max(1, parseInt(one(sp.page), 10) || 1), pages)
  const rows = await db.attendancePunch.findMany({
    where,
    orderBy: { punchedAt: "desc" },
    skip: (page - 1) * size,
    take: size,
    include: { device: true, employee: { include: { department: true } } },
  })
  return (
    <div className="space-y-3">
      <PunchToolbar
        devices={devices.map((d) => ({ value: d.id, label: d.name }))}
        departments={departments.map((d) => ({ value: d.id, label: d.name }))}
        canExport={canExport}
      />
      {unknownCount > 0 && f.match !== "unknown" && (
        <p className="text-sm text-muted-foreground">
          {t("att.unknownCount", { n: unknownCount })}{" "}
          <Link href="/attendance?match=unknown" className="text-primary hover:underline">
            {t("att.showThem")}
          </Link>
          . {t("att.unknownFix")}
        </p>
      )}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-mono text-[11px] uppercase tracking-wide">{t("att.time")}</TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wide">{t("att.pin")}</TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wide">{t("emp.employee")}</TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wide">{t("emp.department")}</TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wide">{t("att.device")}</TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wide">{t("att.distance")}</TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wide">{t("att.type")}</TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wide">{t("att.match")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                  {t("att.noPunches")}
                </TableCell>
              </TableRow>
            )}
            {rows.map((p) => (
              <TableRow
                key={p.id}
                className={
                  p.type === "IN"
                    ? "bg-green-500/10 hover:bg-green-500/15 dark:bg-green-500/15 dark:hover:bg-green-500/20"
                    : "bg-orange-500/10 hover:bg-orange-500/15 dark:bg-orange-500/15 dark:hover:bg-orange-500/20"
                }
              >
                <TableCell className="whitespace-nowrap tabular-nums">{fmtDateTime(p.punchedAt)}</TableCell>
                <TableCell className="font-mono">{p.pin}</TableCell>
                <TableCell>
                  {p.employee ? (
                    <Link className="hover:underline" href={`/employees/${p.employee.id}`}>
                      {p.employee.nameEn}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{p.employee?.department.name ?? "—"}</TableCell>
                <TableCell>{p.device.name}</TableCell>
                <TableCell className="tabular-nums" title={p.accuracyM != null ? t("att.accuracy", { m: p.accuracyM }) : undefined}>
                  {p.distanceM != null ? `${p.distanceM} m` : "—"}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.type === "IN" ? "bg-green-500/20 text-green-700 dark:text-green-300" : "bg-orange-500/20 text-orange-700 dark:text-orange-300"
                    }`}
                  >
                    {p.type === "IN" ? t("att.checkIn") : t("att.checkOut")}
                  </span>
                </TableCell>
                <TableCell>{p.employee ? pill("ok", t("att.matched")) : pill("warn", t("att.unknownPin"))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pager total={total} page={page} size={size} />
      </div>
    </div>
  )
}

async function Daily({ date }: { date: string }) {
  const t = await getT()
  const d = new Date(date + "T00:00:00.000Z")
  const [rows, total] = await Promise.all([
    db.attendanceDaily.findMany({ where: { date: d }, include: { employee: { include: { department: true } } }, orderBy: { employee: { employeeNo: "asc" } } }),
    db.employee.count({ where: { deletedAt: null, status: { countsAsActive: true } } }),
  ])
  const late = rows.filter((r) => r.state === "LATE").length
  const incomplete = rows.filter((r) => r.state === "INCOMPLETE").length
  const prev = new Date(d.getTime() - 86400000).toISOString().slice(0, 10)
  const next = new Date(d.getTime() + 86400000).toISOString().slice(0, 10)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/attendance?tab=daily&date=${prev}`} className="rounded-md border px-2.5 py-1 text-sm hover:bg-muted">
          ‹ {t("common.prev")}
        </Link>
        <span className="min-w-32 text-center text-sm font-medium">{fmtDate(d)}</span>
        <Link href={`/attendance?tab=daily&date=${next}`} className="rounded-md border px-2.5 py-1 text-sm hover:bg-muted">
          {t("common.next")} ›
        </Link>
        <span className="ml-auto text-sm text-muted-foreground">
          {t("att.dailySummary", { present: rows.length, total, late, incomplete, none: Math.max(0, total - rows.length) })}
        </span>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("emp.employee")}</TableHead>
              <TableHead>{t("emp.department")}</TableHead>
              <TableHead>{t("att.in")}</TableHead>
              <TableHead>{t("att.out")}</TableHead>
              <TableHead className="text-right">{t("att.worked")}</TableHead>
              <TableHead>{t("att.state")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {t("att.noDaily")}
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/employees/${r.employeeId}`} className="hover:underline">
                    {r.employee.nameEn}
                  </Link>{" "}
                  <span className="text-xs text-muted-foreground">{r.employee.employeeNo}</span>
                </TableCell>
                <TableCell>{r.employee.department.name}</TableCell>
                <TableCell className="tabular-nums">{fmtTime(r.firstIn)}</TableCell>
                <TableCell className="tabular-nums">{fmtTime(r.lastOut)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.workedMin ? t("time.hm", { h: Math.floor(r.workedMin / 60), m: r.workedMin % 60 }) : "—"}</TableCell>
                <TableCell>{r.state === "PRESENT" ? pill("ok", t("daily.PRESENT")) : r.state === "LATE" ? pill("warn", t("att.lateBy", { m: r.lateMin })) : r.state === "INCOMPLETE" ? pill("bad", t("daily.INCOMPLETE")) : pill("mute", t("daily.ABSENT"))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
