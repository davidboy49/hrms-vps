"use client"

import { useEffect, useState, useTransition } from "react"
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
import { cancelLeave, decideLeave, previewLeave, requestLeave, saveLeaveType, setEntitlement } from "./actions"

type Type = { id: string; code: string; name: string; isPaid: boolean; daysPerYear: number | null; isActive: boolean; allowHalfDay: boolean; proRateNewJoiners: boolean; waitingMonths: number }
type Bal = { typeId: string; allowance: number | null; used: number; pending: number; prorated: boolean; eligibleFrom: string | null }
type Half = "" | "AM" | "PM"
type Req = { id: string; employee: string; mine: boolean; type: string; from: string; to: string; days: number; firstHalf: Half; lastHalf: Half; reason: string; status: string; note: string }
type Emp = { id: string; employeeNo: string; nameEn: string }
type Ent = { employeeId: string; leaveTypeId: string; days: number }

export const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
  REJECTED: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300",
  CANCELLED: "bg-muted text-muted-foreground",
}

const today = () => new Date().toISOString().slice(0, 10)
const num = (n: number) => String(Math.round(n * 10) / 10)

export function LeaveView(props: {
  year: number
  status: string
  canDecide: boolean
  isHr: boolean
  showEmployee: boolean
  hasEmployee: boolean
  types: Type[]
  balances: Bal[]
  employees: Emp[]
  entitlements: Ent[]
  requests: Req[]
}) {
  const t = useT()
  const [pending, start] = useTransition()
  const [form, setForm] = useState(false)
  const [manage, setManage] = useState(false)
  const [ent, setEnt] = useState(false)
  const active = props.types.filter((x) => x.isActive)
  const typeName = (id: string) => props.types.find((x) => x.id === id)?.name ?? ""

  const act = (fn: () => Promise<{ error?: string }>, ok?: string) =>
    start(async () => {
      const r = await fn()
      if (r.error) toast.error(r.error)
      else if (ok) toast.success(ok)
    })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {["", "PENDING", "APPROVED", "REJECTED", "CANCELLED"].map((s) => (
            <Button key={s} size="sm" variant={props.status === s ? "default" : "outline"} render={<Link href={s ? `/leave?status=${s}` : "/leave"} />}>
              {s ? t(`rq.status.${s}`) : t("common.all")}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          {props.showEmployee && (
            <Button variant="outline" render={<Link href="/leave?tab=balances" />}>
              {t("lv.balancesTab")}
            </Button>
          )}
          {props.isHr && (
            <>
              <Button variant="outline" onClick={() => setEnt(true)}>
                {t("lv.entitlements")}
              </Button>
              <Button variant="outline" onClick={() => setManage(true)}>
                <Settings2 /> {t("lv.types")}
              </Button>
            </>
          )}
          <Button onClick={() => setForm(true)}>
            <Plus /> {t("lv.new")}
          </Button>
        </div>
      </div>

      {props.hasEmployee && (
        <section aria-label={t("lv.balances", { year: props.year })}>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">{t("lv.balances", { year: props.year })}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {props.balances.map((b) => {
              const left = b.allowance == null ? null : b.allowance - b.used - b.pending
              const locked = b.eligibleFrom !== null && b.eligibleFrom > today()
              return (
                <li key={b.typeId} className="rounded-xl border p-3">
                  <p className="truncate text-sm font-medium">{typeName(b.typeId)}</p>
                  <p className={cn("mt-1 text-2xl font-semibold tabular-nums", locked && "text-muted-foreground")}>{left == null ? "∞" : num(left)}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("lv.usedOf", { used: num(b.used), total: b.allowance == null ? "∞" : num(b.allowance) })}
                    {b.pending > 0 && ` · ${t("lv.waiting", { n: num(b.pending) })}`}
                  </p>
                  {b.prorated && <p className="text-xs text-muted-foreground">{t("lv.prorated")}</p>}
                  {locked && b.eligibleFrom && <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{t("lv.availableFrom", { date: fmtDate(b.eligibleFrom) })}</p>}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              {props.showEmployee && <th className="px-3 py-2 font-medium">{t("rq.employee")}</th>}
              <th className="px-3 py-2 font-medium">{t("lv.type")}</th>
              <th className="px-3 py-2 font-medium">{t("lv.dates")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("lv.days")}</th>
              <th className="px-3 py-2 font-medium">{t("rq.reason")}</th>
              <th className="px-3 py-2 font-medium">{t("rq.status")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {props.requests.map((r) => (
              <tr key={r.id} className="border-t">
                {props.showEmployee && <td className="px-3 py-2">{r.employee}</td>}
                <td className="px-3 py-2">{r.type}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {fmtDate(r.from)}
                  {r.firstHalf && <span className="text-xs text-muted-foreground"> ({t(r.firstHalf === "AM" ? "lv.morningShort" : "lv.afternoonShort")})</span>}
                  {r.to !== r.from && ` – ${fmtDate(r.to)}`}
                  {r.to !== r.from && r.lastHalf && <span className="text-xs text-muted-foreground"> ({t(r.lastHalf === "AM" ? "lv.morningShort" : "lv.afternoonShort")})</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{num(r.days)}</td>
                <td className="max-w-56 truncate px-3 py-2 text-muted-foreground" title={r.reason || r.note}>
                  {r.reason || "—"}
                  {r.note && <span className="block text-xs">↳ {r.note}</span>}
                </td>
                <td className="px-3 py-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_CLASS[r.status])}>{t(`rq.status.${r.status}`)}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {props.canDecide && r.status === "PENDING" && (
                    <>
                      <Button size="icon-sm" variant="ghost" disabled={pending} aria-label={t("rq.approve")} onClick={() => act(() => decideLeave(r.id, "APPROVED"), t("rq.approved"))}>
                        <Check className="text-emerald-600" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={pending}
                        aria-label={t("rq.reject")}
                        onClick={() => {
                          const note = window.prompt(t("rq.rejectWhy")) ?? undefined
                          act(() => decideLeave(r.id, "REJECTED", note), t("rq.rejected"))
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
                        if (window.confirm(t("rq.cancelConfirm"))) act(() => cancelLeave(r.id), t("rq.cancelled"))
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

      {form && <RequestDialog types={active} employees={props.isHr ? props.employees : []} hasEmployee={props.hasEmployee} onClose={() => setForm(false)} />}
      {manage && <TypesDialog types={props.types} onClose={() => setManage(false)} />}
      {ent && <EntitlementDialog year={props.year} types={active} employees={props.employees} entitlements={props.entitlements} onClose={() => setEnt(false)} />}
    </div>
  )
}

function RequestDialog({ types, employees, hasEmployee, onClose }: { types: Type[]; employees: Emp[]; hasEmployee: boolean; onClose: () => void }) {
  const t = useT()
  const [emp, setEmp] = useState("")
  const [type, setType] = useState(types[0]?.id ?? "")
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const [reason, setReason] = useState("")
  const [firstHalf, setFirstHalf] = useState<Half>("")
  const [lastHalf, setLastHalf] = useState<Half>("")
  const [preview, setPreview] = useState<{ days: number; after: number | null } | { error: string } | null>(null)
  const [err, setErr] = useState<string | null>(employees.length === 0 && !hasEmployee ? t("lv.err.noEmployee") : null)
  const [pending, start] = useTransition()
  const cur = types.find((x) => x.id === type)
  const single = from === to
  const halfOk = Boolean(cur?.allowHalfDay)
  const asHalf = (h: Half) => (halfOk && h ? h : null)

  // live line under the dates: what this request uses and what is left afterwards, checked by the same rules as the real request
  useEffect(() => {
    if (!type || !from || !to || (employees.length > 0 && !hasEmployee && !emp)) return
    let live = true
    const timer = setTimeout(() => {
      previewLeave({ employeeId: emp || undefined, leaveTypeId: type, from, to, firstHalf: asHalf(firstHalf), lastHalf: single ? null : asHalf(lastHalf) })
        .then((r) => live && setPreview(r))
        .catch(() => live && setPreview(null))
    }, 300)
    return () => {
      live = false
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emp, type, from, to, firstHalf, lastHalf])
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("lv.new")}</DialogTitle>
          <DialogDescription>{t("lv.newHint")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              const r = await requestLeave({ employeeId: emp || undefined, leaveTypeId: type, from, to, reason, firstHalf: asHalf(firstHalf), lastHalf: single ? null : asHalf(lastHalf) })
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
              <Label htmlFor="lv-emp">{t("rq.forWho")}</Label>
              <NativeSelect id="lv-emp" value={emp} onChange={(e) => setEmp(e.target.value)} required={!hasEmployee}>
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
            <Label htmlFor="lv-type">{t("lv.type")}</Label>
            <NativeSelect id="lv-type" value={type} onChange={(e) => setType(e.target.value)} required>
              {types.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lv-from">{t("lv.from")}</Label>
              <Input id="lv-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value) }} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lv-to">{t("lv.to")}</Label>
              <Input id="lv-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required />
            </div>
          </div>
          {halfOk && (
            <div className={cn("grid gap-3", !single && "grid-cols-2")}>
              <div className="space-y-1.5">
                <Label htmlFor="lv-h1">{single ? t("lv.part") : t("lv.firstDay")}</Label>
                <NativeSelect id="lv-h1" value={firstHalf} onChange={(e) => setFirstHalf(e.target.value as Half)}>
                  <option value="">{t("lv.wholeDay")}</option>
                  <option value="AM">{t("lv.morning")}</option>
                  <option value="PM">{t("lv.afternoon")}</option>
                </NativeSelect>
              </div>
              {!single && (
                <div className="space-y-1.5">
                  <Label htmlFor="lv-h2">{t("lv.lastDay")}</Label>
                  <NativeSelect id="lv-h2" value={lastHalf} onChange={(e) => setLastHalf(e.target.value as Half)}>
                    <option value="">{t("lv.wholeDay")}</option>
                    <option value="AM">{t("lv.morning")}</option>
                    <option value="PM">{t("lv.afternoon")}</option>
                  </NativeSelect>
                </div>
              )}
            </div>
          )}
          {preview && (
            <p role="status" className={cn("rounded-md px-3 py-2 text-sm", "error" in preview ? "bg-destructive/10 text-destructive" : "bg-muted")}>
              {"error" in preview ? preview.error : t("lv.preview", { days: num(preview.days), after: preview.after == null ? "∞" : num(preview.after) })}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="lv-reason">{t("rq.reason")}</Label>
            <Input id="lv-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </div>
          <p className="text-xs text-muted-foreground">{t("lv.countsNote")}</p>
          {err && (
            <p role="alert" className="text-sm text-destructive">
              {err}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending || types.length === 0 || (preview !== null && "error" in preview)}>
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
          <DialogTitle>{t("lv.types")}</DialogTitle>
          <DialogDescription>{t("lv.typesHint")}</DialogDescription>
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
                  <span className="text-xs text-muted-foreground">
                    {x.daysPerYear == null ? t("lv.noLimit") : t("lv.perYear", { n: x.daysPerYear })} · {x.isPaid ? t("lv.paid") : t("lv.unpaid")}
                    {x.waitingMonths > 0 && ` · ${t("lv.waitShort", { n: x.waitingMonths })}`}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setEdit(x)}>
                    {t("common.edit")}
                  </Button>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button onClick={() => setEdit("new")}>
                <Plus /> {t("lv.newType")}
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
  const [days, setDays] = useState(type?.daysPerYear == null ? "" : String(type.daysPerYear))
  const [paid, setPaid] = useState(type?.isPaid ?? true)
  const [activeFlag, setActive] = useState(type?.isActive ?? true)
  const [halfDay, setHalfDay] = useState(type?.allowHalfDay ?? true)
  const [prorate, setProrate] = useState(type?.proRateNewJoiners ?? false)
  const [wait, setWait] = useState(String(type?.waitingMonths ?? 0))
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await saveLeaveType(type?.id ?? null, { code, name, isPaid: paid, daysPerYear: days === "" ? null : Number(days), isActive: activeFlag, allowHalfDay: halfDay, proRateNewJoiners: prorate, waitingMonths: Math.max(0, Math.round(Number(wait) || 0)) })
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
          <Label htmlFor="lt-code">{t("lv.code")}</Label>
          <Input id="lt-code" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={20} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lt-name">{t("common.name")}</Label>
          <Input id="lt-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lt-days">{t("lv.daysPerYear")}</Label>
        <Input id="lt-days" type="number" min={0} max={366} step="0.5" value={days} onChange={(e) => setDays(e.target.value)} placeholder={t("lv.noLimit")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lt-wait">{t("lv.waitingMonths")}</Label>
        <Input id="lt-wait" type="number" min={0} max={36} step="1" value={wait} onChange={(e) => setWait(e.target.value)} />
        <p className="text-xs text-muted-foreground">{t("lv.waitingHint")}</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={prorate} onChange={(e) => setProrate(e.target.checked)} /> {t("lv.prorate")}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={halfDay} onChange={(e) => setHalfDay(e.target.checked)} /> {t("lv.allowHalf")}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> {t("lv.paid")}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={activeFlag} onChange={(e) => setActive(e.target.checked)} /> {t("lv.active")}
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

function EntitlementDialog({ year, types, employees, entitlements, onClose }: { year: number; types: Type[]; employees: Emp[]; entitlements: Ent[]; onClose: () => void }) {
  const t = useT()
  const [emp, setEmp] = useState(employees[0]?.id ?? "")
  const [pending, start] = useTransition()
  const [vals, setVals] = useState<Record<string, string>>({})
  const current = (typeId: string) => {
    const k = `${emp}|${typeId}`
    if (k in vals) return vals[k]
    const e = entitlements.find((x) => x.employeeId === emp && x.leaveTypeId === typeId)
    return e ? String(e.days) : ""
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("lv.entitlements")} · {year}</DialogTitle>
          <DialogDescription>{t("lv.entHint")}</DialogDescription>
        </DialogHeader>
        <NativeSelect value={emp} onChange={(e) => setEmp(e.target.value)} aria-label={t("rq.employee")}>
          {employees.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nameEn} ({x.employeeNo})
            </option>
          ))}
        </NativeSelect>
        <ul className="space-y-2">
          {types.map((x) => (
            <li key={x.id} className="grid grid-cols-[1fr_6rem_auto] items-center gap-2 text-sm">
              <span className="truncate">{x.name}</span>
              <Input
                type="number"
                min={0}
                max={366}
                step="0.5"
                aria-label={x.name}
                placeholder={x.daysPerYear == null ? "∞" : String(x.daysPerYear)}
                value={current(x.id)}
                onChange={(e) => setVals((v) => ({ ...v, [`${emp}|${x.id}`]: e.target.value }))}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const raw = current(x.id)
                    const r = await setEntitlement(emp, x.id, year, raw === "" ? null : Number(raw))
                    if (r.error) toast.error(r.error)
                    else toast.success(t("common.saved"))
                  })
                }
              >
                {t("common.save")}
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
