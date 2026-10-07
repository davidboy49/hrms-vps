"use client"

import { useMemo, useState, useTransition } from "react"
import { Pencil, Plus, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { NativeSelect } from "@/components/native-select"
import { useT } from "@/i18n/provider"
import { OFF_CLASS, shiftClass } from "@/lib/shift-colours"
import { cn } from "@/lib/utils"
import { assignTemplate, deleteTemplate, saveTemplate } from "../schedule-actions"

type Shift = { id: string; code: string; name: string; startTime: string; endTime: string; colour: string }
type Day = { weekday: number; kind: "WORK" | "OFF"; shiftId: string | null }
type Tpl = { id: string; name: string; count: number; days: Day[] }
type Emp = { id: string; employeeNo: string; nameEn: string; departmentId: string; scheduleTemplateId: string | null }

// shown Monday first, as people read a week
const ORDER = [1, 2, 3, 4, 5, 6, 0]

function DayChip({ day, shifts }: { day: Day; shifts: Shift[] }) {
  const t = useT()
  const s = day.kind === "WORK" && day.shiftId ? shifts.find((x) => x.id === day.shiftId) : null
  return (
    <span className="flex flex-col items-center gap-1">
      <span className="text-[10px] text-muted-foreground">{t(`wds.${day.weekday}`)}</span>
      <span className={cn("grid h-6 min-w-9 place-items-center rounded px-1 text-[11px] font-semibold", day.kind === "OFF" ? OFF_CLASS : s ? shiftClass(s.colour) : "bg-muted text-muted-foreground")}>
        {day.kind === "OFF" ? t("sch.off") : (s?.code ?? t("sch.own"))}
      </span>
    </span>
  )
}

export function TemplatesView({ templates, shifts, employees, departments }: { templates: Tpl[]; shifts: Shift[]; employees: Emp[]; departments: { id: string; name: string }[] }) {
  const t = useT()
  const [edit, setEdit] = useState<Tpl | "new" | null>(null)
  const [assign, setAssign] = useState<Tpl | null>(null)
  const [pending, start] = useTransition()

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEdit("new")}>
          <Plus /> {t("sch.tpl.new")}
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <p>{t("sch.tpl.none")}</p>
          <p className="mt-1">{t("sch.tpl.noneHint")}</p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {templates.map((x) => (
            <li key={x.id} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{x.name}</p>
                  <p className="text-xs text-muted-foreground">{t("sch.tpl.people", { n: x.count })}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="outline" onClick={() => setAssign(x)}>
                    <Users /> {t("sch.tpl.assign")}
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={t("common.edit")} onClick={() => setEdit(x)}>
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t("common.delete")}
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(t("sch.tpl.deleteConfirm", { n: x.count }))) return
                      start(async () => {
                        await deleteTemplate(x.id)
                        toast.success(t("md.deleted"))
                      })
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-7 gap-1.5">
                {ORDER.map((wd) => (
                  <DayChip key={wd} day={x.days.find((d) => d.weekday === wd)!} shifts={shifts} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">{t("sch.tpl.note")}</p>

      {edit && <EditDialog key={edit === "new" ? "new" : edit.id} tpl={edit === "new" ? null : edit} shifts={shifts} onClose={() => setEdit(null)} />}
      {assign && <AssignDialog key={assign.id} tpl={assign} employees={employees} departments={departments} onClose={() => setAssign(null)} />}
    </div>
  )
}

function EditDialog({ tpl, shifts, onClose }: { tpl: Tpl | null; shifts: Shift[]; onClose: () => void }) {
  const t = useT()
  const [name, setName] = useState(tpl?.name ?? "")
  const [days, setDays] = useState<Day[]>(tpl?.days ?? [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, kind: weekday === 0 ? "OFF" : "WORK", shiftId: shifts[0]?.id ?? null })))
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const set = (wd: number, v: string) => setDays((ds) => ds.map((d) => (d.weekday === wd ? (v === "OFF" ? { ...d, kind: "OFF", shiftId: null } : { ...d, kind: "WORK", shiftId: v === "OWN" ? null : v }) : d)))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tpl ? t("sch.tpl.edit") : t("sch.tpl.new")}</DialogTitle>
          <DialogDescription>{t("sch.tpl.editHint")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              const r = await saveTemplate(tpl?.id ?? null, { name, days })
              if (r.error) setErr(r.error)
              else {
                toast.success(t("common.saved"))
                onClose()
              }
            })
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">{t("common.name")}</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("sch.tpl.namePh")} required maxLength={80} />
          </div>
          <div className="space-y-1.5">
            {ORDER.map((wd) => {
              const d = days.find((x) => x.weekday === wd)!
              return (
                <div key={wd} className="grid grid-cols-[6.5rem_1fr] items-center gap-3">
                  <Label htmlFor={`d-${wd}`} className="text-sm font-normal">
                    {t(`wd.${wd}`)}
                  </Label>
                  <NativeSelect id={`d-${wd}`} value={d.kind === "OFF" ? "OFF" : (d.shiftId ?? "OWN")} onChange={(e) => set(wd, e.target.value)}>
                    <option value="OFF">{t("sch.dayOff")}</option>
                    <option value="OWN">{t("sch.ownShift")}</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} · {s.name} ({s.startTime}–{s.endTime})
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              )
            })}
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

function AssignDialog({ tpl, employees, departments, onClose }: { tpl: Tpl; employees: Emp[]; departments: { id: string; name: string }[]; onClose: () => void }) {
  const t = useT()
  const [q, setQ] = useState("")
  const [dept, setDept] = useState("")
  const [sel, setSel] = useState<Set<string>>(() => new Set(employees.filter((e) => e.scheduleTemplateId === tpl.id).map((e) => e.id)))
  const [pending, start] = useTransition()
  const shown = useMemo(
    () => employees.filter((e) => (!dept || e.departmentId === dept) && `${e.nameEn} ${e.employeeNo}`.toLowerCase().includes(q.toLowerCase())),
    [employees, q, dept],
  )
  const allShown = shown.length > 0 && shown.every((e) => sel.has(e.id))
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("sch.assign.title", { name: tpl.name })}</DialogTitle>
          <DialogDescription>{t("sch.assign.hint")}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.search")} aria-label={t("common.search")} />
          <NativeSelect value={dept} onChange={(e) => setDept(e.target.value)} className="w-44" aria-label={t("emp.department")}>
            <option value="">{t("common.all")}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <label className="flex items-center gap-2 border-b pb-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 accent-[var(--primary)]"
            checked={allShown}
            onChange={(e) =>
              setSel((s) => {
                const n = new Set(s)
                for (const x of shown) {
                  if (e.target.checked) n.add(x.id)
                  else n.delete(x.id)
                }
                return n
              })
            }
          />
          {t("sch.assign.all", { n: shown.length })}
        </label>
        <ul className="max-h-72 space-y-0.5 overflow-y-auto">
          {shown.map((e) => (
            <li key={e.id}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={sel.has(e.id)} onChange={() => toggle(e.id)} />
                <span className="min-w-0 flex-1 truncate">{e.nameEn}</span>
                <span className="font-mono text-xs text-muted-foreground">{e.employeeNo}</span>
              </label>
            </li>
          ))}
          {shown.length === 0 && <li className="p-3 text-center text-sm text-muted-foreground">{t("common.noMatches")}</li>}
        </ul>
        <DialogFooter className="items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">{t("common.nSelected", { n: sel.size })}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  // people removed from the list go back to the default week
                  const removed = employees.filter((e) => e.scheduleTemplateId === tpl.id && !sel.has(e.id)).map((e) => e.id)
                  if (removed.length) await assignTemplate(null, removed)
                  const r = await assignTemplate(tpl.id, [...sel])
                  if (r.error) toast.error(r.error)
                  else {
                    toast.success(t("sch.assign.done", { n: r.count ?? 0 }))
                    onClose()
                  }
                })
              }
            >
              {t("common.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
