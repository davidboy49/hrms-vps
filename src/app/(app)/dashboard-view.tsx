"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { CalendarRange, Search, UserCheck, UserMinus, UserPlus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/native-select"
import { PersonAvatar } from "@/components/avatar"
import { StatusBadge } from "@/components/status-badge"
import { useT } from "@/i18n/provider"
import { labelFor } from "@/i18n/core"
import { BASIS_KEY, fmtDate, fmtRate } from "@/lib/format"
import type { DashboardData } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

const money = (n: number, cur: string) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n)
  } catch {
    return `${cur} ${Math.round(n).toLocaleString("en-US")}`
  }
}
const compact = (n: number, cur: string) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, notation: "compact", maximumFractionDigits: 1 }).format(n)
  } catch {
    return Math.round(n).toLocaleString("en-US")
  }
}

// slice colours for the donut, readable on both light and dark backgrounds
const SLICES = ["#0f766e", "#d97706", "#2563eb", "#be185d", "#7c3aed", "#65a30d", "#0891b2", "#9a3412"]

export function DashboardView({ data, canEdit }: { data: DashboardData; canEdit: boolean }) {
  const t = useT()
  const router = useRouter()
  const { period } = data

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <form
          className="relative min-w-52 flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            const q = String(new FormData(e.currentTarget).get("q") ?? "").trim()
            router.push(q ? `/employees?q=${encodeURIComponent(q)}` : "/employees")
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" placeholder={t("dash.search")} aria-label={t("dash.search")} className="h-10 rounded-xl pl-9" />
        </form>
        <PeriodPicker period={period} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          tone="teal"
          icon={<Users className="size-4" />}
          label={t("dash.totalEmployees")}
          value={data.active}
          hint={t("dash.onRecord", { n: data.total })}
          href="/employees"
        />
        <Kpi
          tone="blue"
          icon={<UserCheck className="size-4" />}
          label={t("dash.present")}
          value={data.presentToday}
          hint={`${t("dash.ofActive", { n: data.active })}${data.lateToday ? ` · ${t("dash.lateN", { n: data.lateToday })}` : ""}`}
          href="/attendance?tab=daily"
        />
        <Kpi
          tone="green"
          icon={<UserPlus className="size-4" />}
          label={t("dash.newEmp")}
          value={data.added}
          hint={`${fmtDate(period.from)} – ${fmtDate(period.to)}`}
          href={`/employees?joinFrom=${period.from}&joinTo=${period.to}`}
        />
        <Kpi
          tone="rose"
          icon={<UserMinus className="size-4" />}
          label={t("dash.resigned")}
          value={data.left}
          hint={`${fmtDate(period.from)} – ${fmtDate(period.to)}`}
          href={data.inactiveStatusIds.length ? `/employees?status=${data.inactiveStatusIds.join(",")}` : "/employees"}
        />
      </div>

      <div className={cn("grid gap-4", data.payroll ? "xl:grid-cols-3" : "xl:grid-cols-2")}>
        <Card title={t("dash.attReport")} className={data.payroll ? "xl:col-span-1" : ""} sub={t("dash.attReportSub")}>
          <AttendanceChart data={data} />
        </Card>
        {data.payroll && (
          <Card title={t("dash.payrollEst")} sub={t("dash.payrollNote")}>
            <PayrollDonut payroll={data.payroll} />
          </Card>
        )}
        <Card title={t("dash.service")} sub={t("dash.serviceSub")}>
          <ServiceChart data={data} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title={t("dash.byDept")} className="xl:col-span-1">
          <DeptBars data={data} />
        </Card>
        <div className="xl:col-span-2">
          <PeopleTable data={data} canEdit={canEdit} />
        </div>
      </div>
    </div>
  )
}

/* ---------- building blocks ---------- */

function Card({ title, sub, children, className }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5", className)}>
      <h2 className="font-semibold">{title}</h2>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

const TONES: Record<string, string> = {
  teal: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  green: "bg-green-500/15 text-green-700 dark:text-green-300",
  rose: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
}

function Kpi({ tone, icon, label, value, hint, href }: { tone: string; icon: React.ReactNode; label: string; value: number; hint: string; href: string }) {
  return (
    <Link href={href} className="group rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <span className={cn("grid size-9 place-items-center rounded-full", TONES[tone])}>{icon}</span>
      <p className="mt-4 text-4xl font-semibold tabular-nums tracking-tight">{value.toLocaleString("en-US")}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">{hint}</p>
    </Link>
  )
}

function PeriodPicker({ period }: { period: DashboardData["period"] }) {
  const t = useT()
  const router = useRouter()
  const [from, setFrom] = useState(period.from)
  const [to, setTo] = useState(period.to)
  const custom = period.preset === "custom"
  const [showCustom, setShowCustom] = useState(custom)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarRange className="size-4 text-muted-foreground" aria-hidden />
      <NativeSelect
        aria-label={t("dash.period")}
        value={showCustom || custom ? "custom" : period.preset}
        className="h-10 w-44 rounded-xl"
        onChange={(e) => {
          if (e.target.value === "custom") return setShowCustom(true)
          setShowCustom(false)
          router.push(`/?p=${e.target.value}`)
        }}
      >
        <option value="month">{t("dash.p.month")}</option>
        <option value="last">{t("dash.p.last")}</option>
        <option value="30">{t("dash.p.30")}</option>
        <option value="year">{t("dash.p.year")}</option>
        <option value="custom">{t("dash.p.custom")}</option>
      </NativeSelect>
      {(showCustom || custom) && (
        <>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t("filter.fromDate")} className="h-10 w-40 rounded-xl" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t("filter.toDate")} className="h-10 w-40 rounded-xl" />
          <Button className="h-10 rounded-xl" disabled={!from || !to || from > to} onClick={() => router.push(`/?from=${from}&to=${to}`)}>
            {t("filter.apply")}
          </Button>
        </>
      )}
    </div>
  )
}

/** Tooltip shown next to the pointer position of the hovered chart item. */
function Tip({ children }: { children: React.ReactNode }) {
  return <div className="pointer-events-none absolute -top-2 left-1/2 z-10 w-max -translate-x-1/2 -translate-y-full rounded-lg bg-foreground px-2.5 py-1.5 text-xs text-background shadow-lg">{children}</div>
}

/* ---------- attendance ---------- */

function AttendanceChart({ data }: { data: DashboardData }) {
  const t = useT()
  const [hover, setHover] = useState<number | null>(null)
  const rows = data.attendance
  const denom = Math.max(1, data.active)
  if (rows.length === 0 || rows.every((r) => r.present === 0))
    return <p className="grid h-48 place-items-center text-center text-sm text-muted-foreground">{t("dash.noAttendance")}</p>
  const every = rows.length > 16 ? 2 : 1
  return (
    <div className="flex gap-2">
      <div className="flex h-48 flex-col justify-between pb-6 text-[10px] text-muted-foreground tabular-nums" aria-hidden>
        <span>100%</span>
        <span>50%</span>
        <span>0%</span>
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="absolute inset-x-0 top-0 flex h-48 flex-col justify-between pb-6" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="border-t border-dashed border-border/70" />
          ))}
        </div>
        <div className="relative flex h-48 items-end gap-1">
          {rows.map((r, i) => {
            const pct = Math.min(100, (r.present / denom) * 100)
            const latePct = Math.min(pct, (r.late / denom) * 100)
            return (
              <button
                key={r.date}
                type="button"
                className="relative flex h-full min-w-0 flex-1 flex-col justify-end pb-6 outline-none"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${fmtDate(r.date)}: ${t("dash.attTip", { n: r.present, total: data.active })}`}
              >
                {hover === i && (
                  <Tip>
                    <b>{fmtDate(r.date)}</b>
                    <br />
                    {t("dash.attTip", { n: r.present, total: data.active })}
                    {r.late > 0 && (
                      <>
                        <br />
                        {t("dash.lateN", { n: r.late })}
                      </>
                    )}
                  </Tip>
                )}
                <span className="relative flex w-full flex-col justify-end overflow-hidden rounded-t-md bg-muted" style={{ height: "100%" }}>
                  <span className="flex w-full flex-col justify-end bg-teal-600/90 transition-all dark:bg-teal-400/90" style={{ height: `${pct}%` }}>
                    <span className="w-full bg-amber-500" style={{ height: pct ? `${(latePct / pct) * 100}%` : 0 }} />
                  </span>
                </span>
                <span className="absolute inset-x-0 bottom-0 text-center text-[10px] text-muted-foreground tabular-nums">{i % every === 0 ? r.date.slice(8) : ""}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-1 flex gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-sm bg-teal-600 dark:bg-teal-400" /> {t("dash.legend.present")}
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-sm bg-amber-500" /> {t("dash.legend.late")}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ---------- payroll estimate ---------- */

function PayrollDonut({ payroll }: { payroll: NonNullable<DashboardData["payroll"]> }) {
  const t = useT()
  const [hover, setHover] = useState<number | null>(null)
  const slices = useMemo(() => {
    const top = payroll.byDept.slice(0, 7)
    const rest = payroll.byDept.slice(7).reduce((a, d) => a + d.total, 0)
    return rest > 0 ? [...top, { id: "", name: t("dash.other"), total: rest }] : top
  }, [payroll, t])
  const total = Math.max(1, payroll.total)
  // each slice starts where the previous one ended
  const arcs = slices.map((s, i) => ({ ...s, frac: (s.total / total) * 100, start: slices.slice(0, i).reduce((a, x) => a + (x.total / total) * 100, 0) }))
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-5">
        <div className="relative size-36 shrink-0">
          <svg viewBox="0 0 42 42" className="size-full -rotate-90" role="img" aria-label={t("dash.payrollEst")}>
            <circle cx="21" cy="21" r="15.915" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted" />
            {arcs.map((s, i) => (
              <circle
                key={s.id || "o"}
                cx="21"
                cy="21"
                r="15.915"
                fill="none"
                stroke={SLICES[i % SLICES.length]}
                strokeWidth={hover === i ? 7.5 : 6}
                strokeDasharray={`${Math.max(0, s.frac - 0.6)} ${100 - Math.max(0, s.frac - 0.6)}`}
                strokeDashoffset={-s.start}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-lg font-semibold tabular-nums leading-tight">{hover !== null ? compact(slices[hover].total, payroll.currency) : compact(payroll.total, payroll.currency)}</p>
              <p className="max-w-[5.5rem] truncate text-[10px] text-muted-foreground">{hover !== null ? slices[hover].name : t("dash.perMonth")}</p>
            </div>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
          {slices.map((s, i) => (
            <li key={s.id || "o"} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <Link href={s.id ? `/employees?dept=${s.id}` : "/employees"} className={cn("flex items-center gap-2 rounded-md px-1.5 py-0.5 hover:bg-muted", hover === i && "bg-muted")}>
                <i className="size-2.5 shrink-0 rounded-sm" style={{ background: SLICES[i % SLICES.length] }} />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="tabular-nums text-muted-foreground">{Math.round((s.total / total) * 100)}%</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <dl className="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">{t("dash.estTotal")}</dt>
          <dd className="font-semibold tabular-nums">{money(payroll.total, payroll.currency)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("dash.estEmployees")}</dt>
          <dd className="font-semibold tabular-nums">{payroll.employees}</dd>
        </div>
        {payroll.others.map((o) => (
          <div key={o.currency} className="col-span-2">
            <dt className="text-xs text-muted-foreground">{t("dash.estOther", { cur: o.currency })}</dt>
            <dd className="font-semibold tabular-nums">{money(o.total, o.currency)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/* ---------- length of service ---------- */

const BAR_COLORS = ["#ef4444", "#a3a847", "#16a34a", "#65a30d", "#f59e0b"]

function ServiceChart({ data }: { data: DashboardData }) {
  const t = useT()
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.service.map((s) => s.count))
  return (
    <div className="flex h-56 items-end gap-3">
      {data.service.map((s, i) => (
        <Link
          key={s.id}
          href={`/employees?joinFrom=${s.joinFrom}&joinTo=${s.joinTo}&status=${data.activeStatusIds.join(",")}`}
          className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 outline-none"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(i)}
          onBlur={() => setHover(null)}
          aria-label={`${t(`dash.svc.${s.id}`)}: ${s.count}`}
        >
          {hover === i && <Tip>{t("dash.svcTip", { n: s.count, range: t(`dash.svc.${s.id}`) })}</Tip>}
          <span className="text-xs font-medium tabular-nums">{s.count}</span>
          <span
            className="w-full max-w-14 rounded-t-lg transition-all"
            style={{ height: `${Math.max(2, (s.count / max) * 78)}%`, background: BAR_COLORS[i % BAR_COLORS.length], opacity: hover === null || hover === i ? 1 : 0.5 }}
          />
          <span className="h-5 text-[11px] text-muted-foreground">{t(`dash.svc.${s.id}`)}</span>
        </Link>
      ))}
    </div>
  )
}

/* ---------- departments ---------- */

function DeptBars({ data }: { data: DashboardData }) {
  const t = useT()
  const max = Math.max(1, ...data.departments.map((d) => d.count))
  if (data.departments.length === 0) return <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
  return (
    <ul className="space-y-1">
      {data.departments.map((d) => (
        <li key={d.id}>
          <Link href={`/employees?dept=${d.id}`} className="grid grid-cols-[minmax(0,1fr)_2rem] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
            <span className="truncate">{d.name}</span>
            <span className="text-right tabular-nums text-muted-foreground">{d.count}</span>
            <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary transition-all" style={{ width: `${(d.count / max) * 100}%` }} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/* ---------- people table ---------- */

function PeopleTable({ data, canEdit }: { data: DashboardData; canEdit: boolean }) {
  const t = useT()
  const [tab, setTab] = useState<"recent" | "ending">("recent")
  const rows =
    tab === "recent"
      ? data.recent.map((r) => ({
          id: r.id,
          name: r.name,
          photoUrl: r.photoUrl,
          sub: r.no,
          position: r.designation,
          dept: r.department,
          date: fmtDate(r.joined),
          status: <StatusBadge name={labelFor(t, "status", r.statusCode, r.statusName)} color={r.statusColor} />,
          rate: r.rate !== null ? fmtRate(r.rate, r.basis as "MONTH" | "DAY" | "HOUR", r.currency, t(BASIS_KEY[r.basis as "MONTH" | "DAY" | "HOUR"])) : "",
        }))
      : data.ending.map((r) => ({
          id: r.id,
          name: r.name,
          photoUrl: r.photoUrl,
          sub: "",
          position: r.designation,
          dept: "",
          date: fmtDate(r.contractEnd),
          status: <span className={cn("text-xs", r.days <= 30 ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{t("dash.inDays", { n: r.days })}</span>,
          rate: "",
        }))
  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{t("dash.people")}</h2>
        <div className="inline-flex rounded-lg border p-0.5 text-xs" role="tablist">
          {(["recent", "ending"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn("rounded-md px-3 py-1.5 font-medium transition-colors", tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
            >
              {k === "recent" ? t("dash.recent") : t("dash.endingSoon")}
              {k === "ending" && data.ending.length > 0 && <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 text-amber-700 dark:text-amber-300">{data.ending.length}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">{t("emp.employee")}</th>
              <th className="py-2 pr-3 font-medium">{t("emp.designation")}</th>
              {tab === "recent" && <th className="py-2 pr-3 font-medium">{t("emp.department")}</th>}
              <th className="py-2 pr-3 font-medium">{tab === "recent" ? t("emp.joining") : t("form.contractEnd")}</th>
              {tab === "recent" && canEdit && <th className="py-2 pr-3 text-right font-medium">{t("emp.rate")}</th>}
              <th className="py-2 font-medium">{tab === "recent" ? t("emp.status") : ""}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  {tab === "recent" ? t("common.noData") : t("dash.noEnding")}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="py-2.5 pr-3">
                  <Link href={`/employees/${r.id}`} className="flex items-center gap-2.5">
                    <PersonAvatar name={r.name} url={r.photoUrl} />
                    <span className="leading-tight">
                      <span className="block font-medium">{r.name}</span>
                      {r.sub && <span className="text-xs text-muted-foreground">{r.sub}</span>}
                    </span>
                  </Link>
                </td>
                <td className="py-2.5 pr-3">{r.position}</td>
                {tab === "recent" && <td className="py-2.5 pr-3">{r.dept}</td>}
                <td className="whitespace-nowrap py-2.5 pr-3 tabular-nums">{r.date}</td>
                {tab === "recent" && canEdit && <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">{r.rate}</td>}
                <td className="py-2.5">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-right">
        <Link href="/employees" className="text-xs text-primary hover:underline">
          {t("dash.viewAll")}
        </Link>
      </div>
    </section>
  )
}
