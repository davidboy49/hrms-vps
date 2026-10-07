"use client"

import Link from "next/link"
import { useEffect, useRef, useState, useTransition } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { NativeSelect } from "@/components/native-select"
import { Pager } from "@/components/pager"
import { useLocale, useT } from "@/i18n/provider"
import { useQueryParams } from "@/lib/use-query-params"
import { HOLIDAY_CLASS, LEAVE_CLASS, OFF_CLASS, shiftClass } from "@/lib/shift-colours"
import { cn } from "@/lib/utils"
import { assignTemplate, setRoster, setWeeklyOff } from "../schedule-actions"

type Kind = "WORK" | "OFF" | "HOLIDAY" | "LEAVE"
export type RosterRow = {
  id: string
  name: string
  no: string
  designation: string
  templateId: string | null
  personal: boolean
  weeklyOff: number[]
  cells: { k: Kind; code: string; colour: string; src: string; note: string }[]
}
type Shift = { id: string; code: string; name: string; startTime: string; endTime: string; colour: string }

const ORDER = [1, 2, 3, 4, 5, 6, 0]

function cellStyle(c: RosterRow["cells"][number]) {
  if (c.k === "OFF") return { cls: OFF_CLASS, text: "OFF" }
  if (c.k === "HOLIDAY") return { cls: HOLIDAY_CLASS, text: "PHL" }
  if (c.k === "LEAVE") return { cls: LEAVE_CLASS, text: "LV" }
  return { cls: c.code ? shiftClass(c.colour) : "bg-muted text-muted-foreground", text: c.code || "—" }
}

export function RosterGrid(props: {
  month: string
  prev: string
  next: string
  thisMonth: string
  days: { key: string; num: number; dow: number }[]
  holidays: Record<string, string>
  rows: RosterRow[]
  shifts: Shift[]
  templates: { id: string; name: string }[]
  departments: { id: string; name: string }[]
  total: number
  page: number
  size: number
  canEdit: boolean
  today: string
}) {
  const { month, days, rows, shifts, canEdit, today } = props
  const t = useT()
  const locale = useLocale()
  const { sp, set } = useQueryParams()
  const [q, setQ] = useState(sp.get("q") ?? "")
  const [cell, setCell] = useState<{ row: RosterRow; key: string } | null>(null)
  const [weekly, setWeekly] = useState<RosterRow | null>(null)

  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const timer = setTimeout(() => set({ q: q || null }), 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const label = new Date(month + "-01T00:00:00Z").toLocaleDateString(locale === "km" ? "km-KH" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
  const href = (m: string) => {
    const p = new URLSearchParams(sp.toString())
    p.set("m", m)
    p.delete("page")
    return `/attendance/roster?${p.toString()}`
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("emp.searchPh")} aria-label={t("emp.searchAria")} className="pl-8" />
        </div>
        <NativeSelect value={sp.get("dept") ?? ""} onChange={(e) => set({ dept: e.target.value || null })} className="w-48" aria-label={t("emp.department")}>
          <option value="">{t("sch.roster.allDepts")}</option>
          {props.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </NativeSelect>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" render={<Link href={href(props.prev)} />} aria-label={t("common.prev")}>
            <ChevronLeft />
          </Button>
          <span className="flex min-w-36 items-center justify-center gap-1.5 text-sm font-medium">
            <CalendarDays className="size-4 text-muted-foreground" /> {label}
          </span>
          <Button variant="outline" size="icon" render={<Link href={href(props.next)} />} aria-label={t("common.next")}>
            <ChevronRight />
          </Button>
          {month !== props.thisMonth && (
            <Button variant="ghost" size="sm" render={<Link href={href(props.thisMonth)} />}>
              {t("filter.today")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {shifts.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5" title={`${s.name} ${s.startTime}–${s.endTime}`}>
            <i className={cn("grid h-4 min-w-6 place-items-center rounded px-1 text-[10px] font-semibold not-italic", shiftClass(s.colour))}>{s.code}</i>
            {s.name}
          </span>
        ))}
        <span className="flex items-center gap-1.5"><i className={cn("grid h-4 min-w-6 place-items-center rounded px-1 text-[10px] font-semibold not-italic", OFF_CLASS)}>OFF</i>{t("sch.legend.off")}</span>
        <span className="flex items-center gap-1.5"><i className={cn("grid h-4 min-w-6 place-items-center rounded px-1 text-[10px] font-semibold not-italic", HOLIDAY_CLASS)}>PHL</i>{t("sch.legend.holiday")}</span>
        <span className="flex items-center gap-1.5"><i className={cn("grid h-4 min-w-6 place-items-center rounded px-1 text-[10px] font-semibold not-italic", LEAVE_CLASS)}>LV</i>{t("sch.legend.leave")}</span>
        <span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-primary" />{t("sch.legend.changed")}</span>
      </div>

      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-max min-w-full border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-10 min-w-56 border-b bg-muted px-3 py-2 text-left font-medium">{t("emp.employee")}</th>
                {days.map((d) => (
                  <th key={d.key} title={props.holidays[d.key]} className={cn("min-w-9 border-b px-0.5 py-1 text-center font-normal", d.key === today && "bg-primary/10 text-primary", d.dow === 0 && "text-muted-foreground")}>
                    <span className="block text-[11px] font-medium tabular-nums">{d.num}</span>
                    <span className="block text-[10px] text-muted-foreground">{t(`wds.${d.dow}`)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={days.length + 1} className="h-24 text-center text-muted-foreground">
                    {t("emp.noMatch")}
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="group border-b last:border-0">
                  <td className="sticky left-0 z-10 border-r bg-background px-3 py-1.5 group-hover:bg-muted">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/employees/${r.id}`} className="min-w-0 hover:underline">
                        <span className="block truncate text-[13px] font-medium">{r.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {r.no} · {r.designation}
                        </span>
                      </Link>
                      {canEdit && (
                        <Button size="icon-xs" variant="ghost" className="shrink-0 opacity-60 hover:opacity-100" aria-label={t("sch.weekly.title", { name: r.name })} title={t("sch.weekly.btn")} onClick={() => setWeekly(r)}>
                          <CalendarDays />
                        </Button>
                      )}
                    </div>
                  </td>
                  {r.cells.map((c, i) => {
                    const st = cellStyle(c)
                    const key = days[i].key
                    const inner = (
                      <span className={cn("relative grid h-7 min-w-8 place-items-center rounded text-[10px] font-semibold", st.cls)}>
                        {st.text}
                        {c.src === "roster" && <i className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-primary ring-1 ring-background" />}
                      </span>
                    )
                    return (
                      <td key={key} className={cn("p-0.5", key === today && "bg-primary/5")} title={c.note || undefined}>
                        {canEdit ? (
                          <button type="button" className="block w-full outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setCell({ row: r, key })} aria-label={`${r.name} ${key}`}>
                            {inner}
                          </button>
                        ) : (
                          inner
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager total={props.total} page={props.page} size={props.size} />
      </div>

      {cell && <CellDialog key={cell.row.id + cell.key} row={cell.row} dateKey={cell.key} shifts={shifts} onClose={() => setCell(null)} />}
      {weekly && <WeeklyDialog key={weekly.id} row={weekly} templates={props.templates} onClose={() => setWeekly(null)} />}
    </div>
  )
}

function CellDialog({ row, dateKey, shifts, onClose }: { row: RosterRow; dateKey: string; shifts: Shift[]; onClose: () => void }) {
  const t = useT()
  const [from, setFrom] = useState(dateKey)
  const [to, setTo] = useState(dateKey)
  const [value, setValue] = useState("OFF")
  const [note, setNote] = useState("")
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row.name}</DialogTitle>
          <DialogDescription>{t("sch.cell.hint")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              const r = await setRoster({ employeeId: row.id, from, to: to < from ? from : to, value, note })
              if (r.error) setErr(r.error)
              else {
                toast.success(t("sch.cell.saved", { n: r.count ?? 1 }))
                onClose()
              }
            })
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="c-val">{t("sch.cell.value")}</Label>
            <NativeSelect id="c-val" value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="OFF">{t("sch.dayOff")}</option>
              <option value="LEAVE">{t("sch.legend.leave")}</option>
              <option value="WORK">{t("sch.ownShift")}</option>
              {shifts.map((s) => (
                <option key={s.id} value={`SHIFT:${s.id}`}>
                  {s.code} · {s.name} ({s.startTime}–{s.endTime})
                </option>
              ))}
              <option value="default">{t("sch.cell.default")}</option>
            </NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-from">{t("filter.fromDate")}</Label>
              <Input id="c-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-to">{t("filter.toDate")}</Label>
              <Input id="c-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-note">{t("sch.cell.note")}</Label>
            <Input id="c-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
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
            <Button type="submit" disabled={pending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function WeeklyDialog({ row, templates, onClose }: { row: RosterRow; templates: { id: string; name: string }[]; onClose: () => void }) {
  const t = useT()
  const [off, setOff] = useState<Set<number>>(new Set(row.weeklyOff))
  const [tpl, setTpl] = useState(row.personal ? "" : (row.templateId ?? ""))
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("sch.weekly.title", { name: row.name })}</DialogTitle>
          <DialogDescription>{t("sch.weekly.hint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="w-tpl">{t("sch.weekly.template")}</Label>
            <NativeSelect id="w-tpl" value={tpl} onChange={(e) => setTpl(e.target.value)}>
              <option value="">{t("sch.weekly.personal")}</option>
              {templates.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          {tpl === "" && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("sch.weekly.offDays")}</legend>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
                {ORDER.map((wd) => (
                  <label key={wd} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--primary)]"
                      checked={off.has(wd)}
                      onChange={(e) =>
                        setOff((s) => {
                          const n = new Set(s)
                          if (e.target.checked) n.add(wd)
                          else n.delete(wd)
                          return n
                        })
                      }
                    />
                    {t(`wd.${wd}`)}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {err && (
            <p role="alert" className="text-sm text-destructive">
              {err}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = tpl ? await assignTemplate(tpl, [row.id]) : await setWeeklyOff(row.id, [...off])
                if (r.error) setErr(r.error)
                else {
                  toast.success(t("common.saved"))
                  onClose()
                }
              })
            }
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
