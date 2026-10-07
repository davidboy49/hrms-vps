"use client"

import { useState, useTransition } from "react"
import { Lock, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ALL_PERMISSIONS, PERMISSION_GROUPS, type Permission } from "@/lib/permissions"
import { useT } from "@/i18n/provider"
import { deleteRole, saveRole } from "./roles-actions"

export type RoleRow = { id: string; key: string | null; name: string; description: string; isSystem: boolean; permissions: Permission[]; users: number }

export function RolesPanel({ roles }: { roles: RoleRow[] }) {
  const t = useT()
  const [pending, start] = useTransition()
  // null = closed, "new" = creating, otherwise the role being edited
  const [editing, setEditing] = useState<RoleRow | "new" | null>(null)
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [err, setErr] = useState<string | null>(null)

  const isAdminRole = editing !== null && editing !== "new" && editing.key === "ADMIN"
  const nameLocked = editing !== null && editing !== "new" && editing.isSystem

  function open(r: RoleRow | "new") {
    setErr(null)
    setEditing(r)
    setName(r === "new" ? "" : r.name)
    setDesc(r === "new" ? "" : r.description)
    setPicked(new Set(r === "new" ? [] : r.permissions))
  }
  const toggle = (p: string) =>
    setPicked((cur) => {
      const next = new Set(cur)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  const toggleGroup = (perms: readonly string[]) =>
    setPicked((cur) => {
      const next = new Set(cur)
      const all = perms.every((p) => next.has(p))
      for (const p of perms) {
        if (all) next.delete(p)
        else next.add(p)
      }
      return next
    })

  function submit() {
    start(async () => {
      const r = await saveRole(editing === "new" || editing === null ? null : editing.id, { name, description: desc, permissions: [...picked] })
      if (r.error) {
        setErr(r.error)
        toast.error(r.error)
      } else {
        setEditing(null)
        toast.success(t("roles.saved"))
      }
    })
  }
  function remove(r: RoleRow) {
    if (!confirm(t("roles.confirmDelete", { name: r.name }))) return
    start(async () => {
      const res = await deleteRole(r.id)
      if (res.error) toast.error(res.error)
      else toast.success(t("roles.deleted"))
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">{t("roles.intro")}</p>
        <Button onClick={() => open("new")}>
          <Plus /> {t("roles.add")}
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("users.role")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("roles.permissions")}</TableHead>
              <TableHead>{t("roles.users")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <span className="flex items-center gap-1.5 font-medium">
                    {r.name}
                    {r.isSystem && <Lock className="size-3 text-muted-foreground" aria-label={t("roles.builtIn")} />}
                  </span>
                  {r.description && <span className="text-xs text-muted-foreground">{r.description}</span>}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {r.permissions.length} / {ALL_PERMISSIONS.length}
                </TableCell>
                <TableCell className="text-muted-foreground">{r.users}</TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <Button variant="ghost" size="sm" onClick={() => open(r)}>
                    <Pencil /> {r.key === "ADMIN" ? t("roles.view") : t("common.edit")}
                  </Button>
                  {!r.isSystem && (
                    <Button variant="ghost" size="sm" disabled={pending} onClick={() => remove(r)} aria-label={t("common.delete")}>
                      <Trash2 />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? t("roles.add") : t("roles.editTitle", { name })}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!isAdminRole) submit()
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="r-name">{t("common.name")}</Label>
                <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} disabled={nameLocked} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-desc">{t("roles.description")}</Label>
                <Input id="r-desc" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200} disabled={isAdminRole} />
              </div>
            </div>

            {isAdminRole && <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{t("roles.adminNote")}</p>}

            <div className="space-y-3">
              {PERMISSION_GROUPS.map((g) => {
                const all = g.perms.every((p) => picked.has(p))
                return (
                  <fieldset key={g.group} className="rounded-lg border p-3">
                    <legend className="px-1">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                        <input type="checkbox" checked={isAdminRole || all} disabled={isAdminRole} onChange={() => toggleGroup(g.perms)} className="size-4 accent-primary" />
                        {t(`permgrp.${g.group}`)}
                      </label>
                    </legend>
                    <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                      {g.perms.map((p) => (
                        <label key={p} className="flex cursor-pointer items-start gap-2 text-sm">
                          <input type="checkbox" checked={isAdminRole || picked.has(p)} disabled={isAdminRole} onChange={() => toggle(p)} className="mt-0.5 size-4 accent-primary" />
                          <span>{t(`perm.${p}`)}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )
              })}
            </div>

            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
              {!isAdminRole && <Button type="submit" disabled={pending}>{t("common.save")}</Button>}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
