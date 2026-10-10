import { notFound } from "next/navigation"
import Link from "next/link"
import { Download, Settings2 } from "lucide-react"
import { requirePerm, can } from "@/lib/session"
import { payrollEdition } from "@/lib/edition"
import { buildPayrollInput, isMonthKey } from "@/lib/payroll-input"
import { localDateKey, fmtRate } from "@/lib/format"
import { getT, titleOf } from "@/i18n/server"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export const generateMetadata = titleOf("nav.payroll")
export const dynamic = "force-dynamic"

const num = (n: number) => (n === 0 ? "–" : String(Math.round(n * 100) / 100))
const prevMonth = (today: string) => {
  const [y, m] = today.split("-").map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`
}

/** Payroll edition only: one row per employee for a month, the facts payroll is worked out from. */
export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  if (!payrollEdition()) notFound()
  const user = await requirePerm("payroll.view")
  const t = await getT()
  const sp = await searchParams
  const month = sp.m && isMonthKey(sp.m) ? sp.m : prevMonth(localDateKey(new Date()))
  const data = await buildPayrollInput(month)
  const basisKey: Record<string, string> = { MONTH: "basis.short.MONTH", DAY: "basis.short.DAY", HOUR: "basis.short.HOUR" }
  const th = "whitespace-nowrap text-right"

  return (
    <>
      <PageHeader title={t("nav.payroll")} description={t("pay.desc")} />
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <form className="flex items-end gap-2" method="get">
          <label className="space-y-1.5 text-sm">
            <span className="block text-muted-foreground">{t("pay.month")}</span>
            <Input type="month" name="m" defaultValue={month} className="w-44" />
          </label>
          <Button type="submit" variant="outline">{t("pay.show")}</Button>
        </form>
        <div className="flex gap-2">
          {can(user, "payroll.manage") && (
            <Button variant="outline" render={<Link href="/payroll/setup" />}>
              <Settings2 /> {t("pay.setup")}
            </Button>
          )}
          {can(user, "payroll.export") && (
            <Button render={<Link href={`/payroll/export?m=${month}`} />}>
              <Download /> {t("pay.export")}
            </Button>
          )}
        </div>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{t("pay.through", { from: data.from, through: data.through < data.from ? "–" : data.through })}</p>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>{t("pay.col.employee")}</TableHead>
              <TableHead className={th}>{t("pay.col.rate")}</TableHead>
              <TableHead className={th}>{t("pay.col.scheduled")}</TableHead>
              <TableHead className={th}>{t("pay.col.worked")}</TableHead>
              <TableHead className={th}>{t("pay.col.absent")}</TableHead>
              <TableHead className={th}>{t("pay.col.paidLeave")}</TableHead>
              <TableHead className={th}>{t("pay.col.unpaidLeave")}</TableHead>
              <TableHead className={th}>{t("pay.col.offDay")}</TableHead>
              <TableHead className={th}>{t("pay.col.late")}</TableHead>
              <TableHead className={th}>{t("pay.col.incomplete")}</TableHead>
              <TableHead className={th}>{t("pay.col.ot")}</TableHead>
              <TableHead className={th}>{t("pay.col.otWeighted")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">{t("pay.none")}</TableCell>
              </TableRow>
            )}
            {data.rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <span className="block font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground">{r.employeeNo} · {r.department}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">{fmtRate(r.rate, r.rateBasis as "MONTH", r.currency, t(basisKey[r.rateBasis]))}</TableCell>
                <TableCell className={`${th} tabular-nums`}>{num(r.scheduled)}</TableCell>
                <TableCell className={`${th} tabular-nums`}>{num(r.worked)}</TableCell>
                <TableCell className={`${th} tabular-nums ${r.absent > 0 ? "font-medium text-destructive" : ""}`}>{num(r.absent)}</TableCell>
                <TableCell className={`${th} tabular-nums`}>{num(r.paidLeave)}</TableCell>
                <TableCell className={`${th} tabular-nums`}>{num(r.unpaidLeave)}</TableCell>
                <TableCell className={`${th} tabular-nums`}>{num(r.offDayWork)}</TableCell>
                <TableCell className={`${th} tabular-nums`}>{r.lateDays ? `${r.lateDays} / ${r.lateMin} ${t("pay.min")}` : "–"}</TableCell>
                <TableCell className={`${th} tabular-nums ${r.incomplete > 0 ? "font-medium text-amber-700 dark:text-amber-300" : ""}`}>{num(r.incomplete)}</TableCell>
                <TableCell className={`${th} tabular-nums`}>{num(r.otHours)}</TableCell>
                <TableCell className={`${th} tabular-nums`}>{num(r.otWeighted)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t("pay.note")}</p>
    </>
  )
}
