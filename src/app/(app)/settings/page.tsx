import { Download } from "lucide-react"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/session"
import { fmtDateTime } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PasswordForm, SettingsForm, UsersPanel } from "./forms"
import { LogoUploader } from "./logo-uploader"
import { getBranding } from "@/lib/branding"
import { getT, titleOf } from "@/i18n/server"
import { tgConfig } from "@/lib/telegram"
import { TelegramForm } from "./telegram-form"

export const generateMetadata = titleOf("nav.settings")
export const dynamic = "force-dynamic"

const TABS = [
  { id: "company", label: "set.tab.company" },
  { id: "users", label: "set.tab.users", admin: true },
  { id: "attendance", label: "set.tab.attendance" },
  { id: "numbering", label: "set.tab.numbering" },
  { id: "templates", label: "set.tab.templates" },
  { id: "notifications", label: "set.tab.notifications", admin: true },
  { id: "audit", label: "set.tab.audit", admin: true },
  { id: "account", label: "set.tab.account" },
]

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const t = await getT()
  const user = await requireRole("HR")
  const isAdmin = user.role === "ADMIN"
  const tabs = TABS.filter((x) => !x.admin || isAdmin)
  const sp = await searchParams
  const tab = tabs.find((x) => x.id === sp.tab)?.id ?? "company"

  const brand = await getBranding()
  const settings = Object.fromEntries((await db.setting.findMany()).map((s) => [s.key, s.value]))

  return (
    <>
      <PageHeader title={t(`set.tab.${tab}`)} />

      {tab === "company" && (
        <div className="space-y-8">
          <LogoUploader logoUrl={brand.custom ? brand.logoUrl : null} defaultLogo={brand.logoUrl} canEdit={isAdmin} />
        <SettingsForm
          values={settings}
          disabled={!isAdmin}
          fields={[
            { key: "company.name", label: t("set.companyName"), hint: t("set.companyNameHint") },
            { key: "company.currency", label: t("set.currency"), type: "currency", hint: t("set.currencyHint") },
          ]}
        />
        </div>
      )}

      {tab === "users" && isAdmin && (
        <UsersPanel
          meId={user.id}
          employees={(await db.employee.findMany({ where: { deletedAt: null }, orderBy: { employeeNo: "asc" }, select: { id: true, employeeNo: true, nameEn: true, email: true } })).map((e) => ({
            id: e.id, label: `${e.employeeNo} · ${e.nameEn}`, name: e.nameEn, email: e.email ?? "",
          }))}
          users={(await db.user.findMany({ orderBy: { createdAt: "asc" }, include: { employee: { select: { employeeNo: true, nameEn: true } } } })).map((u) => ({
            id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, lastLogin: u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : t("att.never"),
            employeeId: u.employeeId, employeeLabel: u.employee ? `${u.employee.employeeNo} · ${u.employee.nameEn}` : null,
          }))}
        />
      )}

      {tab === "attendance" && (
        <SettingsForm
          values={settings}
          disabled={!isAdmin}
          fields={[
            { key: "attendance.lateGraceMin", label: t("set.lateGrace"), type: "number", hint: t("set.lateGraceHint") },
            { key: "log.lateAfterMin", label: t("set.logLate"), type: "number", hint: t("set.logLateHint") },
            { key: "log.earlyBeforeMin", label: t("set.logEarly"), type: "number", hint: t("set.logEarlyHint") },
          ]}
        />
      )}

      {tab === "numbering" && (
        <SettingsForm
          values={settings}
          disabled={!isAdmin}
          fields={[{ key: "employee.prefix", label: t("set.prefix"), hint: t("set.prefixHint") }]}
        />
      )}

      {tab === "templates" && (
        <div className="max-w-xl space-y-3">
          <p className="text-sm text-muted-foreground">{t("set.templateDesc")}</p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <Button variant="outline" render={<a href="/employees/template" />}>
            <Download /> {t("set.templateBtn")}
          </Button>
        </div>
      )}

      {tab === "notifications" && isAdmin && await (async () => {
        const c = await tgConfig()
        return <TelegramForm cfg={{ hasToken: Boolean(c.token), chatId: c.chatId, enabled: c.enabled, lang: c.lang, flags: c.flags }} />
      })()}
      {tab === "audit" && isAdmin && <Audit />}
      {tab === "account" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("set.signedInAs")} <b className="text-foreground">{user.email}</b> ({t(`role.${user.role}`)}).
          </p>
          <PasswordForm />
        </div>
      )}
    </>
  )
}

async function Audit() {
  const t = await getT()
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { user: true } })
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("set.audit.when")}</TableHead>
            <TableHead>{t("set.audit.user")}</TableHead>
            <TableHead>{t("set.audit.action")}</TableHead>
            <TableHead>{t("set.audit.detail")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="whitespace-nowrap tabular-nums">{fmtDateTime(l.createdAt)}</TableCell>
              <TableCell>{l.user?.email ?? t("set.audit.system")}</TableCell>
              <TableCell>
                {l.action} <span className="text-muted-foreground">{l.entity}</span>
              </TableCell>
              <TableCell className="text-muted-foreground">{l.detail}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
