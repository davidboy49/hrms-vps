"use client"

import { useState, useTransition } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { NativeSelect } from "@/components/native-select"
import { useT } from "@/i18n/provider"
import { addSuggestedComponents, saveComponent, savePolicy, setComponentActive } from "../actions"

type Policy = { dayDivisorMode: "fixed" | "actual"; dayDivisorFixed: number; hoursPerDay: number; lateDeduction: "off" | "perMinute" }

export function PolicyForm({ policy }: { policy: Policy }) {
  const t = useT()
  const [p, setP] = useState(policy)
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await savePolicy(p)
          if (r.error) setErr(r.error)
          else {
            setErr(null)
            toast.success(t("set.saved"))
          }
        })
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="pp-mode">{t("pay.pol.mode")}</Label>
        <NativeSelect id="pp-mode" value={p.dayDivisorMode} onChange={(e) => setP({ ...p, dayDivisorMode: e.target.value as Policy["dayDivisorMode"] })}>
          <option value="fixed">{t("pay.pol.modeFixed")}</option>
          <option value="actual">{t("pay.pol.modeActual")}</option>
        </NativeSelect>
        <p className="text-xs text-muted-foreground">{t("pay.pol.modeHint")}</p>
      </div>
      {p.dayDivisorMode === "fixed" && (
        <div className="space-y-1.5">
          <Label htmlFor="pp-div">{t("pay.pol.divisor")}</Label>
          <Input id="pp-div" type="number" min={20} max={31} step={1} value={p.dayDivisorFixed} onChange={(e) => setP({ ...p, dayDivisorFixed: Number(e.target.value) })} className="w-32" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="pp-hrs">{t("pay.pol.hours")}</Label>
        <Input id="pp-hrs" type="number" min={1} max={24} step={0.5} value={p.hoursPerDay} onChange={(e) => setP({ ...p, hoursPerDay: Number(e.target.value) })} className="w-32" />
        <p className="text-xs text-muted-foreground">{t("pay.pol.hoursHint")}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pp-late">{t("pay.pol.late")}</Label>
        <NativeSelect id="pp-late" value={p.lateDeduction} onChange={(e) => setP({ ...p, lateDeduction: e.target.value as Policy["lateDeduction"] })}>
          <option value="off">{t("pay.pol.lateOff")}</option>
          <option value="perMinute">{t("pay.pol.lateMin")}</option>
        </NativeSelect>
      </div>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Button type="submit" disabled={pending}>{t("common.save")}</Button>
    </form>
  )
}

export type CompRow = { id: string; code: string; name: string; nameKm: string; kind: "ALLOWANCE" | "DEDUCTION"; calc: "FIXED" | "PERCENT_OF_BASE"; defaultAmount: number | null; taxable: boolean; nssfBase: boolean; isActive: boolean; people: number }

export function ComponentsPanel({ rows }: { rows: CompRow[] }) {
  const t = useT()
  const [pending, start] = useTransition()
  const [edit, setEdit] = useState<CompRow | "new" | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [f, setF] = useState({ code: "", name: "", nameKm: "", kind: "ALLOWANCE" as CompRow["kind"], calc: "FIXED" as CompRow["calc"], defaultAmount: "", taxable: true, nssfBase: false })

  function open(r: CompRow | "new") {
    setErr(null)
    setEdit(r)
    setF(r === "new" ? { code: "", name: "", nameKm: "", kind: "ALLOWANCE", calc: "FIXED", defaultAmount: "", taxable: true, nssfBase: false } : { code: r.code, name: r.name, nameKm: r.nameKm, kind: r.kind, calc: r.calc, defaultAmount: r.defaultAmount === null ? "" : String(r.defaultAmount), taxable: r.taxable, nssfBase: r.nssfBase })
  }
  const amountText = (r: CompRow) => (r.defaultAmount === null ? "—" : r.calc === "PERCENT_OF_BASE" ? `${r.defaultAmount}%` : r.defaultAmount.toLocaleString("en-US", { maximumFractionDigits: 2 }))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-sm text-muted-foreground">{t("pay.componentsHint")}</p>
        <div className="flex gap-2">
          {rows.length === 0 && (
            <Button variant="outline" disabled={pending} onClick={() => start(async () => { await addSuggestedComponents(); toast.success(t("set.saved")) })}>
              {t("pay.addSuggested")}
            </Button>
          )}
          <Button onClick={() => open("new")}>
            <Plus /> {t("pay.addComponent")}
          </Button>
        </div>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("pay.comp.name")}</TableHead>
              <TableHead>{t("pay.comp.kind")}</TableHead>
              <TableHead className="text-right">{t("pay.comp.default")}</TableHead>
              <TableHead>{t("pay.comp.flags")}</TableHead>
              <TableHead className="text-right">{t("pay.comp.people")}</TableHead>
              <TableHead>{t("pay.comp.active")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">{t("pay.noComponents")}</TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id} className={r.isActive ? "" : "opacity-60"}>
                <TableCell>
                  <span className="block font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground">{r.code}{r.nameKm ? ` · ${r.nameKm}` : ""}</span>
                </TableCell>
                <TableCell>{r.kind === "ALLOWANCE" ? t("pay.kind.allowance") : t("pay.kind.deduction")}</TableCell>
                <TableCell className="text-right tabular-nums">{amountText(r)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.kind === "ALLOWANCE" ? [r.taxable ? t("pay.flag.taxable") : t("pay.flag.nonTaxable"), r.nssfBase ? t("pay.flag.nssf") : ""].filter(Boolean).join(" · ") : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.people}</TableCell>
                <TableCell>
                  <Switch size="sm" checked={r.isActive} disabled={pending} aria-label={t("pay.comp.active")} onCheckedChange={(on) => start(async () => { await setComponentActive(r.id, on) })} />
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => open(r)}>{t("common.edit")}</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit === "new" ? t("pay.addComponent") : t("pay.editComponent")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              start(async () => {
                const r = await saveComponent(edit === "new" || edit === null ? null : edit.id, { ...f, defaultAmount: f.defaultAmount === "" ? null : Number(f.defaultAmount) })
                if (r.error) setErr(r.error)
                else {
                  setEdit(null)
                  toast.success(t("set.saved"))
                }
              })
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="c-code">{t("pay.comp.code")}</Label><Input id="c-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} required maxLength={20} autoCapitalize="characters" /></div>
              <div className="space-y-1.5">
                <Label htmlFor="c-kind">{t("pay.comp.kind")}</Label>
                <NativeSelect id="c-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as CompRow["kind"] })}>
                  <option value="ALLOWANCE">{t("pay.kind.allowance")}</option>
                  <option value="DEDUCTION">{t("pay.kind.deduction")}</option>
                </NativeSelect>
              </div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="c-name">{t("pay.comp.name")}</Label><Input id="c-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={60} /></div>
            <div className="space-y-1.5"><Label htmlFor="c-km">{t("pay.comp.nameKm")}</Label><Input id="c-km" value={f.nameKm} onChange={(e) => setF({ ...f, nameKm: e.target.value })} maxLength={60} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-calc">{t("pay.comp.calc")}</Label>
                <NativeSelect id="c-calc" value={f.calc} onChange={(e) => setF({ ...f, calc: e.target.value as CompRow["calc"] })}>
                  <option value="FIXED">{t("pay.calc.fixed")}</option>
                  <option value="PERCENT_OF_BASE">{t("pay.calc.percent")}</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-amt">{f.calc === "PERCENT_OF_BASE" ? t("pay.comp.defaultPct") : t("pay.comp.default")}</Label>
                <Input id="c-amt" type="number" min={0} step="0.01" value={f.defaultAmount} onChange={(e) => setF({ ...f, defaultAmount: e.target.value })} />
              </div>
            </div>
            {f.kind === "ALLOWANCE" && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.taxable} onChange={(e) => setF({ ...f, taxable: e.target.checked })} className="size-4 accent-primary" /> {t("pay.flag.taxableLong")}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.nssfBase} onChange={(e) => setF({ ...f, nssfBase: e.target.checked })} className="size-4 accent-primary" /> {t("pay.flag.nssfLong")}</label>
              </div>
            )}
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEdit(null)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={pending}>{t("common.save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
