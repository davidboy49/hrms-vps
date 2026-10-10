"use client"

import { useState, useTransition } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { NativeSelect } from "@/components/native-select"
import { useT } from "@/i18n/provider"
import { assignComponent, endAssignment, removeAssignment } from "../../payroll/actions"

export type PayItem = { id: string; name: string; kind: "ALLOWANCE" | "DEDUCTION"; calc: "FIXED" | "PERCENT_OF_BASE"; amount: number | null; from: string; to: string | null; note: string; current: boolean }
export type CompOption = { id: string; label: string; kind: "ALLOWANCE" | "DEDUCTION"; calc: "FIXED" | "PERCENT_OF_BASE"; defaultAmount: number | null }

/** Payroll edition: the allowances and deductions this person gets, on the employee profile. */
export function PayItems({ employeeId, currency, items, options, canManage, today }: { employeeId: string; currency: string; items: PayItem[]; options: CompOption[]; canManage: boolean; today: string }) {
  const t = useT()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [f, setF] = useState({ componentId: "", amount: "", validFrom: today, validTo: "", note: "" })
  const picked = options.find((o) => o.id === f.componentId)
  const money = (n: number, calc: PayItem["calc"]) => (calc === "PERCENT_OF_BASE" ? `${n}%` : `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`)
  const run = (fn: () => Promise<{ error?: string }>) => start(async () => { const r = await fn(); if (r.error) toast.error(r.error); else toast.success(t("set.saved")) })

  return (
    <section className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("pay.items")}</h2>
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => { setErr(null); setF({ componentId: "", amount: "", validFrom: today, validTo: "", note: "" }); setOpen(true) }}>
            <Plus /> {t("pay.assign")}
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("pay.itemsNone")}</p>
      ) : (
        <ul className="divide-y text-sm">
          {items.map((i) => (
            <li key={i.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 ${i.current ? "" : "opacity-60"}`}>
              <span>
                <span className="font-medium">{i.name}</span>{" "}
                <span className={i.kind === "ALLOWANCE" ? "text-green-700 dark:text-green-300" : "text-destructive"}>{i.kind === "ALLOWANCE" ? "+" : "−"}{i.amount === null ? "" : money(i.amount, i.calc)}</span>
                <span className="block text-xs text-muted-foreground">{i.from} → {i.to ?? t("pay.ongoing")}{i.note ? ` · ${i.note}` : ""}</span>
              </span>
              {canManage && (
                <span className="flex gap-1">
                  {i.current && !i.to && (
                    <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(() => endAssignment(i.id, today))}>{t("pay.endToday")}</Button>
                  )}
                  <Button size="xs" variant="ghost" disabled={pending} onClick={() => { if (confirm(t("pay.removeAsk"))) run(() => removeAssignment(i.id)) }}>{t("common.delete")}</Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pay.assign")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              start(async () => {
                const r = await assignComponent({ employeeId, componentId: f.componentId, amount: f.amount === "" ? null : Number(f.amount), validFrom: f.validFrom, validTo: f.validTo || null, note: f.note })
                if (r.error) setErr(r.error)
                else {
                  setOpen(false)
                  toast.success(t("set.saved"))
                }
              })
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="pi-c">{t("pay.comp.name")}</Label>
              <NativeSelect id="pi-c" value={f.componentId} onChange={(e) => setF({ ...f, componentId: e.target.value })} required>
                <option value="">{t("common.select")}</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>{o.label} ({o.kind === "ALLOWANCE" ? t("pay.kind.allowance") : t("pay.kind.deduction")})</option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pi-a">{picked?.calc === "PERCENT_OF_BASE" ? t("pay.comp.defaultPct") : `${t("pay.amount")} (${currency})`}</Label>
              <Input id="pi-a" type="number" min={0} step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder={picked?.defaultAmount != null ? t("pay.useDefault", { n: picked.defaultAmount }) : ""} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="pi-f">{t("pay.from")}</Label><Input id="pi-f" type="date" value={f.validFrom} onChange={(e) => setF({ ...f, validFrom: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label htmlFor="pi-t">{t("pay.to")}</Label><Input id="pi-t" type="date" value={f.validTo} onChange={(e) => setF({ ...f, validTo: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="pi-n">{t("pay.itemNote")}</Label><Input id="pi-n" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={200} /></div>
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={pending}>{t("common.save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
