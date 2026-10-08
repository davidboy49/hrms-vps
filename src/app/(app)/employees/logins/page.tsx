import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { db } from "@/lib/db"
import { requirePerm } from "@/lib/session"
import { grantableRoles, MAX_BATCH, TEMP_PASSWORD_DAYS } from "@/lib/bulk-logins"
import { getLocale, getT, titleOf } from "@/i18n/server"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { BulkLoginsClient } from "./bulk-logins-client"

export const generateMetadata = titleOf("bl.title")
export const dynamic = "force-dynamic"

export default async function BulkLoginsPage() {
  const t = await getT()
  const locale = await getLocale()
  const user = await requirePerm("users.createBatch")
  const [emps, roles, withLogin] = await Promise.all([
    // active, not deleted, and no login yet
    db.employee.findMany({
      where: { deletedAt: null, status: { countsAsActive: true }, user: null },
      orderBy: { employeeNo: "asc" },
      take: 2000,
      select: { id: true, employeeNo: true, nameEn: true, nameKm: true, department: { select: { name: true } }, designation: { select: { name: true } } },
    }),
    grantableRoles(user),
    db.user.count({ where: { employeeId: { not: null } } }),
  ])
  const rows = emps.map((e) => ({ id: e.id, no: e.employeeNo, name: locale === "km" && e.nameKm ? e.nameKm : e.nameEn, department: e.department.name, designation: e.designation.name }))
  const defaultRole = roles.find((r) => r.key === "EMPLOYEE") ?? roles[0]
  return (
    <>
      <PageHeader
        title={t("bl.title")}
        description={t("bl.sub", { n: rows.length, linked: withLogin })}
        actions={
          <Button variant="outline" size="sm" render={<Link href="/employees" />}>
            <ArrowLeft className="size-4" /> {t("bl.back")}
          </Button>
        }
      />
      <BulkLoginsClient rows={rows} roles={roles.map((r) => ({ id: r.id, name: r.name }))} defaultRoleId={defaultRole?.id ?? ""} max={MAX_BATCH} days={TEMP_PASSWORD_DAYS} />
    </>
  )
}
