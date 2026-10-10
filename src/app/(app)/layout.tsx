import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { can, requireUser } from "@/lib/session"
import { getBranding } from "@/lib/branding"
import { AppShell } from "@/components/app-shell"
import { SubscriptionBanner } from "@/components/subscription-banner"
import { EnvBanner } from "@/components/env-banner"
import { versionLabel } from "@/lib/version"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const [brand, jar, row, sus] = await Promise.all([getBranding(), cookies(), db.user.findUnique({ where: { id: user.id }, select: { favorites: true } }), db.setting.findUnique({ where: { key: "attendance.suspicious" } })])
  // the Suspicious tab is only offered while the checks are switched on
  const shellUser = sus?.value === "1" ? user : { ...user, perms: user.perms.filter((p) => p !== "attendance.review") }
  // pinned unless the person has switched it off
  const initialPinned = jar.get("pd_sidebar")?.value !== "0"
  return (
    <AppShell
      user={shellUser}
      company={brand.company}
      logoUrl={brand.logoUrl}
      initialPinned={initialPinned}
      initialFavorites={row?.favorites ?? []}
      version={user.roleIsSystem && (user.role === "ADMIN" || user.role === "HR") ? versionLabel() : null}
      notice={
        <>
          <EnvBanner />
          {can(user, "settings.view") ? <SubscriptionBanner /> : null}
        </>
      }
    >
      {children}
    </AppShell>
  )
}
