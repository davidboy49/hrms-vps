"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Check, Plus, Settings2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { NativeSelect } from "@/components/native-select"
import { useT } from "@/i18n/provider"
import { fmtDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { STATUS_CLASS } from "../leave/leave-view"
import { cancelOvertime, decideOvertime, requestOvertime, saveOvertimeType } from "./actions"

type Type = { id: string; code: string; name: string; multiplier: number; isActive: boolean }
type Req = { id: string; employee: string; mine: boolean; type: string; date: string; hours: number; reason: string; status: string; note: string }
type Emp = { id: string; employeeNo: string; nameEn: string }

export function OvertimeView(props: { status: string; isHr: boolean; showEmployee: boolean; hasEmployee: boolean; types: Type[]; employees: Emp[]; requests: Req[] }) {
  const t = useT()
  const [pending, start] = useTransition()
  const [form, setForm] = useState(false)
  const [manage, setManage] = useState(false)
  const act = (fn: () => Promise<{ error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn()
      if (r.error) toast.error(r.error)
      else toast.success(ok)
    })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {["", "PENDING", "APPROVED", "REJECTED", "CANCELLED"].map((s) => (
            <Button key={s} size="sm" variant={props.status === s ? "default" : "outline"} render={<Link href={s ? `/overtime?status=${s}` : "/overtime"} />}>
              {s ? t(`rq.status.${s}`) : t("common.all")}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          {props.isHr && (
            <Button variant="outline" onClick={() => setManage(true)}>
              <Settings2 /> {t("ot.types")}
            </Button>
          )}
          <Button onClick={() => setForm(true)}>
            <Plus /> {t("ot.new")}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              {props.showEmployee && <th className="px-3 py-2 font-medium">{t("rq.employee")}</th>}
              <th className="px-3 py-2 font-medium">{t("common.date")}</th>
              <th className="px-3 py-2 font-medium">{t("ot.type")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("ot.hours")}</th>
              <th className="px-3 py-2 font-medium">{t("rq.reason")}</th>
              <th className="px-3 py-2 font-medium">{t("rq.status")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {props.requests.map((r) => (
              <tr key={r.id} className="border-t">
                {props.showEmployee && <td className="px-3 py-2">{r.employee}</td>}
                <td className="whitespace-nowrap px-3 py-2">{fmtDate(r.date)}</td>
                <td className="px-3 py-2">{r.type}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.hours}</td>
                <td className="max-w-56 truncate px-3 py-2 text-muted-foreground" title={r.reason || r.note}>
                  {r.reason || "—"}
                  {r.note && <span className="block text-xs">↳ {r.note}</span>}
                </td>
                <td className="px-3 py-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_CLASS[r.status])}>{t(`rq.status.${r.status}`)}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {props.isHr && r.status === "PENDING" && (
                    <>
                      <Button size="icon-sm" variant="ghost" disabled={pending} aria-label={t("rq.approve")} onClick={() => act(() => decideOvertime(r.id, "APPROVED"), t("rq.approved"))}>
                        <Check className="text-emerald-600" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={pending}
                        aria-label={t("rq.reject")}
                        onClick={() => {
                          const note = window.prompt(t("rq.rejectWhy")) ?? undefined
                          act(() => decideOvertime(r.id, "REJECTED", note), t("rq.rejected"))
                        }}
                      >
                        <X className="text-rose-600" />
                      </Button>
                    </>
                  )}
                  {((r.mine && r.status === "PENDING") || (props.isHr && (r.status === "PENDING" || r.status === "APPROVED"))) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm(t("rq.cancelConfirm"))) act(() => cancelOvertime(r.id), t("rq.cancelled"))
                      }}
                    >
                      {t("common.cancel")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {props.requests.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  {t("rq.none")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {form && <RequestDialog types={props.types.filter((x) => x.isActive)} employees={props.isHr ? props.employees : []} hasEmployee={props.hasEmployee} onClose={() => setForm(false)} />}
      {manage && <TypesDialog types={props.types} onClose={() => setManage(false)} />}
    </div>
  )
}

function RequestDialog({ types, employees, hasEmployee, onClose }: { types: Type[]; employees: Emp[]; hasEmployee: boolean; onClose: () => void }) {
  const t = useT()
  const [emp, setEmp] = useState("")
  const [type, setType] = useState(types[0]?.id ?? "")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [hours, setHours] = useState("1")
  const [reason, setReason] = useState("")
  const [err, setErr] = useState<string | null>(employees.length === 0 && !hasEmployee ? t("lv.err.noEmployee") : null)
  const [pending, start] = useTransition()
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("ot.new")}</DialogTitle>
          <DialogDescription>{t("ot.newHint")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              const r = await requestOvertime({ employeeId: emp || undefined, overtimeTypeId: type, date, hours: Number(hours), reason })
              if (r.error) setErr(r.error)
              else {
                toast.success(t("rq.sent"))
                onClose()
              }
            })
          }}
        >
          {employees.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="ot-emp">{t("rq.forWho")}</Label>
              <NativeSelect id="ot-emp" value={emp} onChange={(e) => setEmp(e.target.value)} required={!hasEmployee}>
                <option value="">{hasEmployee ? t("rq.me") : t("common.select")}</option>
                {employees.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nameEn} ({x.employeeNo})
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ot-type">{t("ot.type")}</Label>
            <NativeSelect id="ot-type" value={type} onChange={(e) => setType(e.target.value)} required>
              {types.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} ×{x.multiplier}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ot-date">{t("common.date")}</Label>
              <Input id="ot-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ot-hours">{t("ot.hours")}</Label>
              <Input id="ot-hours" type="number" min={0.25} max={16} step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ot-reason">{t("rq.reason")}</Label>
            <Input id="ot-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </div>
          {err && (
            <p role="alert" className="text-sm text-destructive">
              {err}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending || types.length === 0}>
              {t("rq.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TypesDialog({ types, onClose }: { types: Type[]; onClose: () => void }) {
  const t = useT()
  const [edit, setEdit] = useState<Type | "new" | null>(null)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("ot.types")}</DialogTitle>
          <DialogDescription>{t("ot.typesHint")}</DialogDescription>
        </DialogHeader>
        {edit ? (
          <TypeForm key={edit === "new" ? "new" : edit.id} type={edit === "new" ? null : edit} onDone={() => setEdit(null)} />
        ) : (
          <>
            <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
              {types.map((x) => (
                <li key={x.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className={cn("min-w-0 flex-1 truncate", !x.isActive && "text-muted-foreground line-through")}>
                    {x.name} <span className="font-mono text-xs text-muted-foreground">{x.code}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">×{x.multiplier}</span>
                  <Button size="sm" variant="ghost" onClick={() => setEdit(x)}>
                    {t("common.edit")}
                  </Button>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button onClick={() => setEdit("new")}>
                <Plus /> {t("ot.newType")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function TypeForm({ type, onDone }: { type: Type | null; onDone: () => void }) {
  const t = useT()
  const [code, setCode] = useState(type?.code ?? "")
  const [name, setName] = useState(type?.name ?? "")
  const [mult, setMult] = useState(String(type?.multiplier ?? 1.5))
  const [active, setActive] = useState(type?.isActive ?? true)
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await saveOvertimeType(type?.id ?? null, { code, name, multiplier: Number(mult), isActive: active })
          if (r.error) setErr(r.error)
          else {
            toast.success(t("common.saved"))
            onDone()
          }
        })
      }}
    >
      <div className="grid grid-cols-[7rem_1fr] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ott-code">{t("lv.code")}</Label>
          <Input id="ott-code" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={20} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ott-name">{t("common.name")}</Label>
          <Input id="ott-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ott-mult">{t("ot.multiplier")}</Label>
        <Input id="ott-mult" type="number" min={1} max={10} step="0.05" value={mult} onChange={(e) => setMult(e.target.value)} required />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={active} onChange={(e) => setActive(e.target.checked)} /> {t("lv.active")}
      </label>
      {err && (
        <p role="alert" className="text-sm text-destructive">
          {err}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {t("common.save")}
        </Button>
      </DialogFooter>
    </form>
  )
}
