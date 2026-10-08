import { Download } from "lucide-react"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { can, permsOf, requireUser } from "@/lib/session"
import type { Permission } from "@/lib/permissions"
import { fmtDateTime } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PasswordForm, SettingsForm, UsersPanel } from "./forms"
import { RolesPanel } from "./roles-panel"
import { LogoUploader } from "./logo-uploader"
import { getBranding } from "@/lib/branding"
import { getT, titleOf } from "@/i18n/server"
import { tgConfig } from "@/lib/telegram"
import { TelegramForm } from "./telegram-form"

export const generateMetadata = titleOf("nav.settings")
export const dynamic = "force-dynamic"

const TABS: { id: string; label: string; perm: Permission }[] = [
  { id: "company", label: "set.tab.company", perm: "settings.view" },
  { id: "users", label: "set.tab.users", perm: "users.manage" },
  { id: "roles", label: "set.tab.roles", perm: "roles.manage" },
  { id: "attendance", label: "set.tab.attendance", perm: "settings.view" },
  { id: "numbering", label: "set.tab.numbering", perm: "settings.view" },
  { id: "templates", label: "set.tab.templates", perm: "settings.view" },
  { id: "notifications", label: "set.tab.notifications", perm: "settings.notifications" },
  { id: "audit", label: "set.tab.audit", perm: "audit.view" },
  { id: "account", label: "set.tab.account", perm: "settings.view" },
]

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const t = await getT()
  const user = await requireUser()
  const tabs = TABS.filter((x) => can(user, x.perm))
  if (tabs.length === 0) redirect("/?denied=1")
  const sp = await searchParams
  const tab = (tabs.find((x) => x.id === sp.tab) ?? tabs[0]).id
  const isAdmin = can(user, "settings.manage")

  const roleList = tab === "users" || tab === "roles" ? await db.appRole.findMany({ orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }], include: { _count: { select: { users: true } } } }) : []
  const roleOpts = roleList.map((r) => ({ id: r.id, key: r.key, label: r.isSystem && r.key ? t(`role.${r.key}`) : r.name }))
  const roleRows = roleList.map((r) => ({
    id: r.id, key: r.key, name: r.isSystem && r.key ? t(`role.${r.key}`) : r.name, description: r.description, isSystem: r.isSystem,
    permissions: permsOf(r), users: r._count.users,
  }))

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

      {tab === "users" && (
        <UsersPanel
          meId={user.id}
          roles={roleOpts}
          employees={(await db.employee.findMany({ where: { deletedAt: null }, orderBy: { employeeNo: "asc" }, select: { id: true, employeeNo: true, nameEn: true, email: true } })).map((e) => ({
            id: e.id, no: e.employeeNo, label: `${e.employeeNo} · ${e.nameEn}`, name: e.nameEn, email: e.email ?? "",
          }))}
          users={(await db.user.findMany({ orderBy: { createdAt: "asc" }, include: { employee: { select: { employeeNo: true, nameEn: true } } } })).map((u) => ({
            id: u.id, name: u.name, username: u.username, email: u.email ?? "", roleId: u.roleId, isActive: u.isActive, lastLogin: u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : t("att.never"),
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

      {tab === "notifications" && await (async () => {
        const c = await tgConfig()
        return <TelegramForm cfg={{ hasToken: Boolean(c.token), chatId: c.chatId, enabled: c.enabled, lang: c.lang, flags: c.flags }} />
      })()}
      {tab === "audit" && <Audit />}
      {tab === "roles" && <RolesPanel roles={roleRows} />}
      {tab === "account" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("set.signedInAs")} <b className="text-foreground">{user.username}</b> ({user.roleIsSystem ? t(`role.${user.role}`) : user.roleName}).
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
              <TableCell>{l.user?.username ?? t("set.audit.system")}</TableCell>
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
