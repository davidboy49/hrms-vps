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
import { changeOwnPassword, createUser, saveSettings, updateUser } from "./actions"
import { useT } from "@/i18n/provider"

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

type U = { id: string; name: string; email: string; role: string; isActive: boolean; lastLogin: string; employeeId: string | null; employeeLabel: string | null }
type Emp = { id: string; label: string; name: string; email: string }
type RoleKey = "ADMIN" | "HR" | "MANAGER" | "EMPLOYEE"

export function UsersPanel({ users, meId, employees }: { users: U[]; meId: string; employees: Emp[] }) {
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
                  <span className="text-xs text-muted-foreground">{u.email}</span>
                </TableCell>
                <TableCell>
                  <NativeSelect
                    value={u.role}
                    disabled={u.id === meId || pending}
                    onChange={(e) => run(() => updateUser(u.id, { role: e.target.value as RoleKey }), t("users.roleUpdated"))}
                    className="h-7 w-28"
                    aria-label={t("users.roleFor", { name: u.name })}
                  >
                    <option value="ADMIN">{t("role.ADMIN")}</option>
                    <option value="HR">{t("role.HR")}</option>
                    <option value="MANAGER">{t("role.MANAGER")}</option>
                    <option value="EMPLOYEE">{t("role.EMPLOYEE")}</option>
                  </NativeSelect>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.employeeLabel ?? "—"}</TableCell>
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
                  const r = document.getElementById("u-role") as HTMLSelectElement | null
                  if (r && r.value === "HR") r.value = "EMPLOYEE"
                }}
              >
                <option value="">{t("users.notLinked")}</option>
                {employees.filter((x) => !linked.has(x.id)).map((x) => (
                  <option key={x.id} value={x.id}>{x.label}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5"><Label htmlFor="u-name">{t("common.name")}</Label><Input id="u-name" name="name" required /></div>
            <div className="space-y-1.5"><Label htmlFor="u-email">{t("login.email")}</Label><Input id="u-email" name="email" type="email" required /></div>
            <div className="space-y-1.5">
              <Label htmlFor="u-role">{t("users.role")}</Label>
              <NativeSelect id="u-role" name="role" defaultValue="HR">
                <option value="ADMIN">{t("role.ADMIN")}</option>
                <option value="HR">{t("role.HR")}</option>
                <option value="MANAGER">{t("role.MANAGER")}</option>
                <option value="EMPLOYEE">{t("role.EMPLOYEE.long")}</option>
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
                const r = await updateUser(editing!.id, { name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? ""), employeeId: String(fd.get("employeeId") ?? "") || null })
                if (r.error) setErr(r.error)
                else {
                  setEditing(null)
                  toast.success(t("users.updated"))
                }
              })
            }
          >
            <div className="space-y-1.5"><Label htmlFor="e-name">{t("common.name")}</Label><Input id="e-name" name="name" defaultValue={editing?.name} required /></div>
            <div className="space-y-1.5"><Label htmlFor="e-email">{t("users.emailSignIn")}</Label><Input id="e-email" name="email" type="email" defaultValue={editing?.email} required /></div>
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
