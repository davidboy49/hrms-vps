import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { db } from "@/lib/db"
import { requirePerm } from "@/lib/session"
import { payrollEdition } from "@/lib/edition"
import { getPolicy } from "@/lib/pay-policy"
import { getT, titleOf } from "@/i18n/server"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { PolicyForm, ComponentsPanel } from "./setup-forms"

export const generateMetadata = titleOf("pay.setup")
export const dynamic = "force-dynamic"

/** Payroll edition only: how pay is worked out, and the allowance and deduction types. */
export default async function PayrollSetupPage() {
  if (!payrollEdition()) notFound()
  await requirePerm("payroll.manage")
  const t = await getT()
  const [policy, components, counts] = await Promise.all([
    getPolicy(),
    db.payComponent.findMany({ orderBy: [{ kind: "asc" }, { code: "asc" }] }),
    db.employeeComponent.groupBy({ by: ["componentId"], _count: { _all: true } }),
  ])
  const used = new Map(counts.map((c) => [c.componentId, c._count._all]))
  return (
    <>
      <PageHeader title={t("pay.setup")} description={t("pay.setupDesc")} />
      <div className="mb-4">
        <Button variant="ghost" size="sm" render={<Link href="/payroll" />}>
          <ArrowLeft /> {t("nav.payroll")}
        </Button>
      </div>
      <div className="space-y-10">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{t("pay.policy")}</h2>
          <PolicyForm policy={policy} />
        </section>
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{t("pay.components")}</h2>
          <ComponentsPanel
            rows={components.map((c) => ({
              id: c.id, code: c.code, name: c.name, nameKm: c.nameKm ?? "", kind: c.kind, calc: c.calc,
              defaultAmount: c.defaultAmount === null ? null : Number(c.defaultAmount), taxable: c.taxable, nssfBase: c.nssfBase, isActive: c.isActive, people: used.get(c.id) ?? 0,
            }))}
          />
        </section>
      </div>
    </>
  )
}
