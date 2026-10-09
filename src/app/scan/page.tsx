import Link from "next/link"
import { redirect } from "next/navigation"
import { QrCode } from "lucide-react"
import { db } from "@/lib/db"
import { getPendingPasswordUser, getSession, can } from "@/lib/session"
import { QR_REASON_KEY, resolveQr, suggestedType } from "@/lib/qr-attendance"
import { fmtDateTime } from "@/lib/format"
import { SignOutButton } from "@/components/sign-out-button"
import { Button } from "@/components/ui/button"
import { ScanClient } from "./scan-client"
import { ActiveAnnouncements } from "@/components/active-announcements"
import { getT, titleOf } from "@/i18n/server"
import { getBranding } from "@/lib/branding"
import { LanguageSwitcher } from "@/components/language-switcher"
import { I18nProvider } from "@/i18n/provider"

export const generateMetadata = titleOf("scan.title")
export const dynamic = "force-dynamic"

export default async function ScanPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  // a company can make this page Khmer only (Settings → Company): staff then never see the language switch
  const khmerOnly = (await db.setting.findUnique({ where: { key: "scan.khmerOnly" } }))?.value === "1"
  const t = await getT(khmerOnly ? "km" : undefined)
  const sp = await searchParams
  const token = typeof sp.t === "string" ? sp.t : ""
  const user = await getSession()
  const brand = await getBranding()
  if (!user && (await getPendingPasswordUser())) redirect("/change-password")
  if (!user) redirect(`/login${token ? `?next=${encodeURIComponent(`/scan?t=${token}`)}` : "?next=/scan"}`)

  const me = await db.user.findUnique({ where: { id: user.id }, include: { employee: true } })
  const emp = me?.employee && !me.employee.deletedAt ? me.employee : null
  const check = token ? await resolveQr(token) : null
  const loc = check?.ok ? check.loc : null

  const [recent, suggested] = emp
    ? await Promise.all([
        db.attendancePunch.findMany({ where: { employeeId: emp.id }, orderBy: { punchedAt: "desc" }, take: 6, include: { device: true } }),
        suggestedType(emp.id),
      ])
    : [[], "IN" as const]

  const page = (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-5 p-5">
      {/* on a narrow phone the controls drop under the company name instead of pushing the page wider than the screen */}
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-44 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logoUrl} alt="" className="size-9 shrink-0 rounded-xl bg-white object-contain p-0.5 ring-1 ring-border" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold">{brand.company}</span>
            <span className="block truncate text-[10px] text-muted-foreground">{t("app.poweredBy", { name: "HR Toch" })}</span>
          </span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {!khmerOnly && <LanguageSwitcher />}
          {can(user, "dashboard.view") && (
            <Button variant="ghost" size="sm" render={<Link href="/" />}>
              {t("nav.dashboard")}
            </Button>
          )}
          <SignOutButton />
        </div>
      </header>

      <ActiveAnnouncements limit={2} />

      <section>
        <p className="text-sm text-muted-foreground">{t("scan.signedInAs")}</p>
        <h1 className="text-xl font-semibold tracking-tight">{emp?.nameEn ?? user.name}</h1>
        {emp && <p className="text-sm text-muted-foreground">{emp.employeeNo}</p>}
      </section>

      {!emp ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          {t("scan.notLinked")}
        </p>
      ) : token && check?.ok && loc ? (
        <ScanClient token={token} suggested={suggested} location={loc.name} needsGeo={loc.qrMode === "STATIC" || loc.latitude != null} />
      ) : token ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {check && !check.ok ? t(QR_REASON_KEY[check.reason]) : null}
        </p>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border p-4 text-sm">
          <QrCode className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>{t("scan.howTo")}</p>
        </div>
      )}

      {emp && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">{t("scan.recent")}</h2>
          <ul className="divide-y rounded-lg border text-sm">
            {recent.length === 0 && <li className="p-3 text-muted-foreground">{t("scan.none")}</li>}
            {recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-3">
                <span>
                  <span className="font-medium">{p.type === "IN" ? t("att.checkIn") : t("att.checkOut")}</span>
                  <span className="block text-xs text-muted-foreground">{p.device.name}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">{fmtDateTime(p.punchedAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
  return khmerOnly ? <I18nProvider locale="km">{page}</I18nProvider> : page
}
