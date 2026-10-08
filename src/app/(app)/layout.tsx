import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { can, requireUser } from "@/lib/session"
import { getBranding } from "@/lib/branding"
import { AppShell } from "@/components/app-shell"
import { SubscriptionBanner } from "@/components/subscription-banner"
import { versionLabel } from "@/lib/version"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const [brand, jar, row] = await Promise.all([getBranding(), cookies(), db.user.findUnique({ where: { id: user.id }, select: { favorites: true } })])
  // pinned unless the person has switched it off
  const initialPinned = jar.get("pd_sidebar")?.value !== "0"
  return (
    <AppShell
      user={user}
      company={brand.company}
      logoUrl={brand.logoUrl}
      initialPinned={initialPinned}
      initialFavorites={row?.favorites ?? []}
      version={user.roleIsSystem && (user.role === "ADMIN" || user.role === "HR") ? versionLabel() : null}
      notice={can(user, "settings.view") ? <SubscriptionBanner /> : null}
    >
      {children}
    </AppShell>
  )
}
