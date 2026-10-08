import { cookies } from "next/headers"
import { can, requireUser } from "@/lib/session"
import { getBranding } from "@/lib/branding"
import { AppShell } from "@/components/app-shell"
import { SubscriptionBanner } from "@/components/subscription-banner"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const [brand, jar] = await Promise.all([getBranding(), cookies()])
  // pinned unless the person has switched it off
  const initialPinned = jar.get("pd_sidebar")?.value !== "0"
  return (
    <AppShell
      user={user}
      company={brand.company}
      logoUrl={brand.logoUrl}
      initialPinned={initialPinned}
      notice={can(user, "settings.view") ? <SubscriptionBanner /> : null}
    >
      {children}
    </AppShell>
  )
}
