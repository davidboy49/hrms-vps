import { redirect } from "next/navigation"
import { getPendingPasswordUser, getSession } from "@/lib/session"
import { getT } from "@/i18n/server"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ChangePasswordForm } from "./change-password-form"

export const dynamic = "force-dynamic"

export async function generateMetadata() {
  return { title: (await getT())("cp.title") }
}

export default async function ChangePasswordPage() {
  const t = await getT()
  const pending = await getPendingPasswordUser()
  if (!pending) redirect((await getSession()) ? "/" : "/login")
  return (
    <main className="relative grid min-h-svh place-items-center p-6">
      <LanguageSwitcher className="absolute right-4 top-4" />
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold">{t("cp.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("cp.intro", { name: pending.name })}</p>
        </div>
        <ChangePasswordForm />
      </div>
    </main>
  )
}
