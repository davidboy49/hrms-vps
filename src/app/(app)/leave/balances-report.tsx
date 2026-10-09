import Link from "next/link"
import { Download } from "lucide-react"
import { db } from "@/lib/db"
import { balancesFor } from "@/lib/leave"
import { getT } from "@/i18n/server"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const num = (n: number) => String(Math.round(n * 10) / 10)

/** Everyone's leave quota for a year: allowance, used, waiting and what is left, per leave type. */
export async function BalancesReport({ year }: { year: number }) {
  const t = await getT()
  const [types, emps] = await Promise.all([
    db.leaveType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.employee.findMany({ where: { deletedAt: null, status: { countsAsActive: true } }, orderBy: { employeeNo: "asc" }, select: { id: true, employeeNo: true, nameEn: true, department: { select: { name: true } } } }),
  ])
  const bals = await balancesFor(emps.map((e) => e.id), year)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" render={<Link href={`/leave?tab=balances&year=${year - 1}`} />}>
            ‹ {year - 1}
          </Button>
          <span className="px-3 text-sm font-medium tabular-nums">{year}</span>
          <Button size="sm" variant="outline" render={<Link href={`/leave?tab=balances&year=${year + 1}`} />}>
            {year + 1} ›
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/leave" />}>
            {t("lv.backToRequests")}
          </Button>
          <Button render={<a href={`/leave/balances/export?year=${year}`} />}>
            <Download /> {t("export.xlsx")}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("lv.balancesNote")}</p>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{t("form.employeeNo")}</th>
              <th className="px-3 py-2 font-medium">{t("common.name")}</th>
              {types.map((x) => (
                <th key={x.id} className="px-3 py-2 text-right font-medium">
                  {x.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {emps.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{e.employeeNo}</td>
                <td className="px-3 py-2">
                  {e.nameEn}
                  <span className="block text-xs text-muted-foreground">{e.department.name}</span>
                </td>
                {types.map((x) => {
                  const b = bals.get(e.id)?.find((y) => y.typeId === x.id)
                  if (!b) return <td key={x.id} />
                  const left = b.allowance == null ? null : b.allowance - b.used - b.pending
                  return (
                    <td key={x.id} className="px-3 py-2 text-right tabular-nums">
                      <span className={cn("font-medium", left != null && left <= 0 && "text-rose-600")}>{left == null ? "∞" : num(left)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {num(b.used)} / {b.allowance == null ? "∞" : num(b.allowance)}
                        {b.pending > 0 && ` · ${t("lv.waiting", { n: num(b.pending) })}`}
                        {b.prorated && ` · ${t("lv.proratedShort")}`}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
            {emps.length === 0 && (
              <tr>
                <td colSpan={2 + types.length} className="p-8 text-center text-muted-foreground">
                  {t("rq.none")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
