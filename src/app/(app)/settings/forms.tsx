"use client"

import { useState, useTransition } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { NativeSelect } from "@/components/native-select"
import { changeOwnPassword, createUser, resetTwoFactor, saveSettings, setTwoFactorRequired, updateUser } from "./actions"
import { Switch } from "@/components/ui/switch"
import { useT } from "@/i18n/provider"
import { suggestUsername } from "@/lib/username"

export function SettingsForm({ values, fields, disabled }: { values: Record<string, string>; fields: { key: string; label: string; hint?: string; type?: string }[]; disabled: boolean }) {
  const t = useT()
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  return (
    <form
      className="max-w-xl space-y-4"
      action={(fd) =>
        start(async () => {
          const r = await saveSettings(fd)
          if (r.error) setErr(r.error)
          else {
            setErr(null)
            toast.success(t("set.saved"))
          }
        })
      }
    >
      {fields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={f.key}>{f.label}</Label>
          {f.type === "currency" ? (
            <NativeSelect id={f.key} name={f.key} defaultValue={values[f.key] ?? "USD"} disabled={disabled}>
              <option value="USD">USD</option>
              <option value="KHR">KHR</option>
            </NativeSelect>
          ) : f.type === "khmerOnly" ? (
            <NativeSelect id={f.key} name={f.key} defaultValue={values[f.key] === "1" ? "1" : "0"} disabled={disabled}>
              <option value="0">{t("set.scanBoth")}</option>
              <option value="1">{t("set.scanKhmerOnly")}</option>
            </NativeSelect>
          ) : (
            <Input id={f.key} name={f.key} type={f.type ?? "text"} defaultValue={values[f.key] ?? ""} disabled={disabled} />
          )}
          {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
        </div>
      ))}
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      {!disabled && (
        <Button type="submit" disabled={pending}>
          {t("common.save")}
        </Button>
      )}
    </form>
  )
}

type U = { id: string; name: string; username: string; email: string; roleId: string; isActive: boolean; lastLogin: string; employeeId: string | null; employeeLabel: string | null; twoFactor: { required: boolean; enrolled: boolean } }
type Emp = { id: string; no: string; label: string; name: string; email: string }
export type RoleOpt = { id: string; key: string | null; label: string }

export function UsersPanel({ users, meId, canManage2fa, employees, roles }: { users: U[]; meId: string; canManage2fa: boolean; employees: Emp[]; roles: RoleOpt[] }) {
  const t = useT()
  const linked = new Set(users.map((u) => u.employeeId).filter(Boolean))
  const [open, setOpen] = useState(false)
  const [reset, setReset] = useState<U | null>(null)
  const [editing, setEditing] = useState<U | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn()
      if (r.error) toast.error(r.error)
      else toast.success(ok)
    })

  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <p className="text-sm text-muted-foreground">Admin: everything. HR: employees, rate, masterdata, attendance. Manager: read only, no rate. Employee: phone check-in by QR only (link a login to an employee record).</p>
        <Button onClick={() => { setErr(null); setOpen(true) }}>
          <Plus /> {t("users.add")}
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("users.user")}</TableHead>
              <TableHead>{t("users.role")}</TableHead>
              <TableHead>{t("emp.employee")}</TableHead>
              <TableHead>{t("users.twoFactor")}</TableHead>
              <TableHead>{t("users.lastLogin")}</TableHead>
              <TableHead>{t("emp.status")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <span className="block font-medium">{u.name}</span>
                  <span className="text-xs text-muted-foreground">{u.username}{u.email ? ` · ${u.email}` : ""}</span>
                </TableCell>
                <TableCell>
                  <NativeSelect
                    value={u.roleId}
                    disabled={u.id === meId || pending}
                    onChange={(e) => run(() => updateUser(u.id, { roleId: e.target.value }), t("users.roleUpdated"))}
                    className="h-7 w-40"
                    aria-label={t("users.roleFor", { name: u.name })}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </NativeSelect>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.employeeLabel ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      size="sm"
                      checked={u.twoFactor.required}
                      disabled={!canManage2fa || pending}
                      aria-label={t("users.twoFactorFor", { name: u.name })}
                      onCheckedChange={(on) => run(() => setTwoFactorRequired(u.id, on), on ? t("users.twoFactorOn") : t("users.twoFactorOff"))}
                    />
                    <span className="text-xs text-muted-foreground">
                      {u.twoFactor.required ? (u.twoFactor.enrolled ? t("users.twoFactorReady") : t("users.twoFactorPending")) : t("users.twoFactorNone")}
                    </span>
                    {canManage2fa && u.twoFactor.required && (
                      <Button size="xs" variant="ghost" disabled={pending} onClick={() => { if (confirm(t("users.twoFactorResetAsk", { name: u.name }))) run(() => resetTwoFactor(u.id), t("users.twoFactorResetDone")) }}>
                        {t("users.twoFactorReset")}
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.lastLogin}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${u.isActive ? "bg-green-500/15 text-green-700 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
                    <span className="size-1.5 rounded-full bg-current" />
                    {u.isActive ? t("users.active") : t("users.disabled")}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setErr(null); setEditing(u) }}>
                    {t("common.edit")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setErr(null); setReset(u) }}>
                    {t("users.resetPw")}
                  </Button>
                  {u.id !== meId && (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => updateUser(u.id, { isActive: !u.isActive }), u.isActive ? t("users.disabledToast") : t("users.enabledToast"))}>
                      {u.isActive ? t("users.disable") : t("users.enable")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.add")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            action={(fd) =>
              start(async () => {
                const r = await createUser(fd)
                if (r.error) setErr(r.error)
                else {
                  setOpen(false)
                  toast.success(t("users.created"))
                }
              })
            }
          >
            <div className="space-y-1.5">
              <Label htmlFor="u-emp">{t("users.linkOpt")}</Label>
              <NativeSelect
                id="u-emp"
                name="employeeId"
                defaultValue=""
                onChange={(e) => {
                  const emp = employees.find((x) => x.id === e.target.value)
                  if (!emp) return
                  const n = document.getElementById("u-name") as HTMLInputElement | null
                  const m = document.getElementById("u-email") as HTMLInputElement | null
                  if (n && !n.value) n.value = emp.name
                  if (m && !m.value) m.value = emp.email
                  const un = document.getElementById("u-username") as HTMLInputElement | null
                  if (un && !un.value) un.value = suggestUsername(emp.no)
                  const r = document.getElementById("u-role") as HTMLSelectElement | null
                  const staff = roles.find((x) => x.key === "EMPLOYEE")
                  if (r && staff && r.value === roles.find((x) => x.key === "HR")?.id) r.value = staff.id
                }}
              >
                <option value="">{t("users.notLinked")}</option>
                {employees.filter((x) => !linked.has(x.id)).map((x) => (
                  <option key={x.id} value={x.id}>{x.label}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5"><Label htmlFor="u-name">{t("common.name")}</Label><Input id="u-name" name="name" required /></div>
            <div className="space-y-1.5">
              <Label htmlFor="u-username">{t("users.username")}</Label>
              <Input id="u-username" name="username" required minLength={3} maxLength={32} pattern="[a-zA-Z0-9._\-]+" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
              <p className="text-xs text-muted-foreground">{t("users.usernameHint")}</p>
            </div>
            <div className="space-y-1.5"><Label htmlFor="u-email">{t("users.emailOptional")}</Label><Input id="u-email" name="email" type="email" /></div>
            <div className="space-y-1.5">
              <Label htmlFor="u-role">{t("users.role")}</Label>
              <NativeSelect id="u-role" name="roleId" defaultValue={roles.find((x) => x.key === "HR")?.id ?? roles[0]?.id}>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5"><Label htmlFor="u-pw">{t("login.password")}</Label><Input id="u-pw" name="password" type="text" minLength={10} required /></div>
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={pending}>{t("users.create")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.edit")}</DialogTitle>
          </DialogHeader>
          <form
            key={editing?.id}
            className="space-y-3"
            action={(fd) =>
              start(async () => {
                const r = await updateUser(editing!.id, { name: String(fd.get("name") ?? ""), username: String(fd.get("username") ?? ""), email: String(fd.get("email") ?? ""), employeeId: String(fd.get("employeeId") ?? "") || null })
                if (r.error) setErr(r.error)
                else {
                  setEditing(null)
                  toast.success(t("users.updated"))
                }
              })
            }
          >
            <div className="space-y-1.5"><Label htmlFor="e-name">{t("common.name")}</Label><Input id="e-name" name="name" defaultValue={editing?.name} required /></div>
            <div className="space-y-1.5">
              <Label htmlFor="e-username">{t("users.username")}</Label>
              <Input id="e-username" name="username" defaultValue={editing?.username} required minLength={3} maxLength={32} pattern="[a-zA-Z0-9._\-]+" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            </div>
            <div className="space-y-1.5"><Label htmlFor="e-email">{t("users.emailOptional")}</Label><Input id="e-email" name="email" type="email" defaultValue={editing?.email} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="e-emp">{t("users.linked")}</Label>
              <NativeSelect id="e-emp" name="employeeId" defaultValue={editing?.employeeId ?? ""}>
                <option value="">{t("users.notLinked")}</option>
                {employees.filter((x) => !linked.has(x.id) || x.id === editing?.employeeId).map((x) => (
                  <option key={x.id} value={x.id}>{x.label}</option>
                ))}
              </NativeSelect>
            </div>
            <p className="text-xs text-muted-foreground">{t("users.editNote")}</p>
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={pending}>{t("common.save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={reset !== null} onOpenChange={(o) => !o && setReset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.resetFor", { name: reset?.name ?? "" })}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            action={(fd) =>
              start(async () => {
                const r = await updateUser(reset!.id, { password: String(fd.get("password") ?? "") })
                if (r.error) setErr(r.error)
                else {
                  setReset(null)
                  toast.success(t("users.pwReset"))
                }
              })
            }
          >
            <div className="space-y-1.5"><Label htmlFor="r-pw">{t("users.newPw")}</Label><Input id="r-pw" name="password" type="text" minLength={10} required /></div>
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReset(null)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={pending}>{t("users.reset")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function PasswordForm() {
  const t = useT()
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  return (
    <form
      className="max-w-sm space-y-4"
      action={(fd) =>
        start(async () => {
          const r = await changeOwnPassword(fd)
          if (r.error) setErr(r.error)
          else {
            setErr(null)
            toast.success(t("users.pwChanged"))
          }
        })
      }
    >
      <div className="space-y-1.5"><Label htmlFor="p-cur">{t("users.curPw")}</Label><Input id="p-cur" name="current" type="password" autoComplete="current-password" required /></div>
      <div className="space-y-1.5"><Label htmlFor="p-new">{t("users.newPw")}</Label><Input id="p-new" name="next" type="password" autoComplete="new-password" minLength={10} required /></div>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Button type="submit" disabled={pending}>{t("users.changePw")}</Button>
    </form>
  )
}
