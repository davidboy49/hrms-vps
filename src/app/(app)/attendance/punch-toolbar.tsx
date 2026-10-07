"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Download, Filter, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MultiSelect, type Option } from "@/components/multi-select"
import { NativeSelect } from "@/components/native-select"
import { useQueryParams } from "@/lib/use-query-params"
import { useT } from "@/i18n/provider"

type F = { from: string; to: string; device: string[]; dept: string[]; type: string; match: string }
const csv = (s: string | null) => (s ? s.split(",").filter(Boolean) : [])

export function PunchToolbar({ devices, departments, canExport }: { devices: Option[]; departments: Option[]; canExport: boolean }) {
  const t = useT()
  const { sp, set } = useQueryParams()
  const [q, setQ] = useState(sp.get("q") ?? "")
  const [open, setOpen] = useState(false)

  const applied: F = useMemo(
    () => ({ from: sp.get("from") ?? "", to: sp.get("to") ?? "", device: csv(sp.get("device")), dept: csv(sp.get("dept")), type: sp.get("type") ?? "", match: sp.get("match") ?? "" }),
    [sp],
  )
  const [draft, setDraft] = useState<F>(applied)

  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const t = setTimeout(() => set({ q: q || null }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const count = [applied.from || applied.to, applied.device.length, applied.dept.length, applied.type, applied.match].filter(Boolean).length
  const name = (o: Option[], id: string) => o.find((x) => x.value === id)?.label ?? id

  const chips: { k: string; text: string; clear: () => void }[] = []
  if (applied.from || applied.to) chips.push({ k: "date", text: `${t("common.date")}: ${applied.from || "…"} – ${applied.to || "…"}`, clear: () => set({ from: null, to: null }) })
  if (applied.device.length) chips.push({ k: "device", text: `${t("att.device")}: ${applied.device.map((d) => name(devices, d)).join(", ")}`, clear: () => set({ device: null }) })
  if (applied.dept.length) chips.push({ k: "dept", text: `${t("emp.department")}: ${applied.dept.map((d) => name(departments, d)).join(", ")}`, clear: () => set({ dept: null }) })
  if (applied.type) chips.push({ k: "type", text: applied.type === "IN" ? t("att.checkIn") : t("att.checkOut"), clear: () => set({ type: null }) })
  if (applied.match) chips.push({ k: "match", text: applied.match === "unknown" ? t("att.unknownOnly") : t("att.matchedOnly"), clear: () => set({ match: null }) })

  const clearAll = () => {
    setQ("")
    set({ q: null, from: null, to: null, device: null, dept: null, type: null, match: null })
  }
  const apply = () =>
    set({
      from: draft.from || null,
      to: draft.to || null,
      device: draft.device.join(",") || null,
      dept: draft.dept.join(",") || null,
      type: draft.type || null,
      match: draft.match || null,
    })

  const exportHref = (fmt: string) => {
    const p = new URLSearchParams([...sp.entries()].filter(([k]) => !["page", "size", "tab"].includes(k)))
    p.set("format", fmt)
    return `/attendance/export?${p.toString()}`
  }

  // quick ranges, in the viewer's local calendar
  const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  const quick = (back: number) => {
    const to = new Date()
    const from = new Date(Date.now() - back * 86400_000)
    setDraft({ ...draft, from: day(from), to: day(to) })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("att.searchPh")} className="pl-8" aria-label={t("att.searchAria")} />
        </div>
        <Button
          variant={count ? "secondary" : "outline"}
          aria-expanded={open}
          onClick={() => {
            setDraft(applied)
            setOpen((o) => !o)
          }}
        >
          <Filter /> {t("filter.advanced")}
          {count > 0 && <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{count}</span>}
        </Button>
        {canExport && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              <Download /> {t("common.export")}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("export.current")}</DropdownMenuLabel>
              <DropdownMenuItem render={<a href={exportHref("xlsx")} />}>{t("export.xlsx")}</DropdownMenuItem>
              <DropdownMenuItem render={<a href={exportHref("csv")} />}>{t("export.csv")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {open && (
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="pf-from">{t("filter.fromDate")}</Label>
              <Input id="pf-from" type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-to">{t("filter.toDate")}</Label>
              <Input id="pf-to" type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("att.device")}</Label>
              <MultiSelect options={devices} value={draft.device} onChange={(v) => setDraft({ ...draft, device: v })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("emp.department")}</Label>
              <MultiSelect options={departments} value={draft.dept} onChange={(v) => setDraft({ ...draft, dept: v })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-type">{t("att.type")}</Label>
              <NativeSelect id="pf-type" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                <option value="">{t("common.any")}</option>
                <option value="IN">{t("att.checkIn")}</option>
                <option value="OUT">{t("att.checkOut")}</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-match">{t("att.match")}</Label>
              <NativeSelect id="pf-match" value={draft.match} onChange={(e) => setDraft({ ...draft, match: e.target.value })}>
                <option value="">{t("common.all")}</option>
                <option value="matched">{t("att.matchedEmp")}</option>
                <option value="unknown">{t("att.unknownPin")}</option>
              </NativeSelect>
            </div>
            <div className="flex items-end gap-1.5 sm:col-span-2">
              <Button type="button" variant="outline" size="sm" onClick={() => quick(0)}>
                {t("filter.today")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => quick(6)}>
                {t("filter.last7")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => quick(29)}>
                {t("filter.last30")}
              </Button>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={clearAll}>
              {t("filter.clearAll")}
            </Button>
            <Button onClick={apply}>{t("filter.apply")}</Button>
          </div>
        </div>
      )}

      {(chips.length > 0 || q) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button key={c.k} onClick={c.clear} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20">
              {c.text} <X className="size-3" />
            </button>
          ))}
          <button onClick={clearAll} className="px-1 text-xs text-muted-foreground hover:text-foreground">
            {t("filter.clearAll")}
          </button>
        </div>
      )}
    </div>
  )
}
