"use client"

import { useMemo, useState, useTransition } from "react"
import { Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { NativeSelect } from "@/components/native-select"
import type { FieldDef } from "@/lib/masterdata"
import { deleteRow, saveRow, setActive } from "../actions"
import { useT } from "@/i18n/provider"

export type MRow = {
  id: string
  isActive: boolean
  count: number | null
  values: Record<string, string | boolean>
  display: Record<string, string>
}

export function MasterTable({
  entityKey,
  singular,
  fields,
  relOpts,
  rows,
  showCount,
  isAdmin,
}: {
  entityKey: string
  singular: string
  fields: FieldDef[]
  relOpts: Record<string, { value: string; label: string }[]>
  rows: MRow[]
  showCount: boolean
  isAdmin: boolean
}) {
  const t = useT()
  const [q, setQ] = useState("")
  const [edit, setEdit] = useState<MRow | "new" | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const shown = useMemo(() => rows.filter((r) => Object.values(r.display).join(" ").toLowerCase().includes(q.toLowerCase())), [rows, q])
  const cols = fields.filter((f) => f.column)
  const cur = edit && edit !== "new" ? edit : null

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("md.search", { name: singular })} className="pl-8" aria-label={t("common.search")} />
        </div>
        <Button onClick={() => { setErr(null); setEdit("new") }}>
          <Plus /> {t("md.add", { name: singular })}
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {cols.map((c) => (
                <TableHead key={c.name} className="font-mono text-[11px] uppercase tracking-wide">
                  {t(c.label)}
                </TableHead>
              ))}
              {showCount && <TableHead className="text-right font-mono text-[11px] uppercase tracking-wide">{t("md.employees")}</TableHead>}
              <TableHead className="font-mono text-[11px] uppercase tracking-wide">{t("md.active")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={cols.length + 3} className="h-24 text-center text-muted-foreground">
                  {t("md.empty")}
                </TableCell>
              </TableRow>
            )}
            {shown.map((r) => (
              <TableRow key={r.id} className={r.isActive ? "" : "text-muted-foreground"}>
                {cols.map((c) => (
                  <TableCell key={c.name} className={c.name === "code" ? "font-mono" : ""}>
                    {r.display[c.name]}
                  </TableCell>
                ))}
                {showCount && <TableCell className="text-right tabular-nums">{r.count}</TableCell>}
                <TableCell>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${r.isActive ? "bg-green-500/15 text-green-700 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
                    <span className="size-1.5 rounded-full bg-current" />
                    {r.isActive ? t("common.yes") : t("common.no")}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setErr(null); setEdit(r) }}>
                    {t("common.edit")}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await setActive(entityKey, r.id, !r.isActive) })}>
                    {r.isActive ? t("md.deactivate") : t("md.activate")}
                  </Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm(t("md.deleteConfirm", { name: singular }))) return
                        start(async () => {
                          const res = await deleteRow(entityKey, r.id)
                          if (res.error) toast.error(res.error)
                          else toast.success(t("md.deleted"))
                        })
                      }}
                    >
                      {t("common.delete")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {cur ? t("md.edit", { name: singular }) : t("md.add", { name: singular })}
            </DialogTitle>
          </DialogHeader>
          <form
            key={cur?.id ?? "new"}
            action={(fd) =>
              start(async () => {
                const res = await saveRow(entityKey, cur?.id ?? null, fd)
                if (res.error) setErr(res.error)
                else {
                  setEdit(null)
                  toast.success(t("common.saved"))
                }
              })
            }
            className="space-y-3"
          >
            {fields.map((f) => {
              const id = `f-${f.name}`
              const v = cur?.values[f.name]
              return (
                <div key={f.name} className="space-y-1.5">
                  {f.type === "bool" ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name={f.name} defaultChecked={cur ? Boolean(v) : f.name === "countsAsActive"} className="size-4 accent-[var(--primary)]" />
                      {t(f.label)}
                    </label>
                  ) : (
                    <>
                      <Label htmlFor={id}>{t(f.label)}</Label>
                      {f.type === "select" || f.type === "relation" ? (
                        <NativeSelect id={id} name={f.name} defaultValue={(v as string) ?? (f.options?.[0]?.value ?? "")}>
                          {f.type === "relation" && <option value="">—</option>}
                          {(f.type === "select" ? f.options : relOpts[f.name])?.filter((o) => o.value !== cur?.id).map((o) => (
                            <option key={o.value} value={o.value}>
                              {f.type === "select" ? t(o.label) : o.label}
                            </option>
                          ))}
                        </NativeSelect>
                      ) : (
                        <Input
                          id={id}
                          name={f.name}
                          defaultValue={(v as string) ?? (f.name === "radiusM" ? "150" : f.type === "number" ? "10" : "")}
                          type={f.type === "date" ? "date" : f.type === "time" ? "time" : f.type === "number" ? "number" : "text"}
                          inputMode={f.type === "decimal" ? "decimal" : undefined}
                          placeholder={f.type === "decimal" ? t("md.decimalPh") : undefined}
                          required={f.required}
                          className={f.name === "code" ? "font-mono uppercase" : ""}
                        />
                      )}
                    </>
                  )}
                </div>
              )
            })}
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEdit(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
