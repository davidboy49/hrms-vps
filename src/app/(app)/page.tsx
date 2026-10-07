import { redirect } from "next/navigation"
import { atLeast, requireUser } from "@/lib/session"
import { loadDashboard, parsePeriod } from "@/lib/dashboard"
import { getT, titleOf } from "@/i18n/server"
import { PageHeader } from "@/components/page-header"
import { DashboardView } from "./dashboard-view"
import { ActiveAnnouncements } from "@/components/active-announcements"

export const generateMetadata = titleOf("nav.dashboard")
export const dynamic = "force-dynamic"

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getT()
  const user = await requireUser()
  const sp = await searchParams
  if (!atLeast(user.role, "MANAGER")) redirect("/scan")
  const canEdit = atLeast(user.role, "HR")

  const data = await loadDashboard(parsePeriod(sp), canEdit)

  return (
    <>
      <PageHeader title={t("nav.dashboard")} description={t("dash.hello", { name: user.name.split(" ")[0] })} />
      {sp.denied && <p className="mb-4 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">{t("dash.denied")}</p>}
      <div className="mb-5 empty:hidden">
        <ActiveAnnouncements />
      </div>
      <DashboardView data={data} canEdit={canEdit} />
    </>
  )
}
