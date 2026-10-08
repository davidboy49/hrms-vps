"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Download, Loader2, Printer, TriangleAlert, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createLogins, previewLogins, type CreateResult, type PreviewResult } from "./actions"
import { useT } from "@/i18n/provider"

type Row = { id: string; no: string; name: string; department: string; designation: string }
type Done = Extract<CreateResult, { ok: true }>
type Prev = Extract<PreviewResult, { ok: true }>

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export function BulkLoginsClient({ rows, roles, defaultRoleId, max, days }: { rows: Row[]; roles: { id: string; name: string }[]; defaultRoleId: string; max: number; days: number }) {
  const t = useT()
  const router = useRouter()
  const [q, setQ] = useState("")
  const [dept, setDept] = useState("")
  const [roleId, setRoleId] = useState(defaultRoleId)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [prev, setPrev] = useState<Prev | null>(null)
  const [ack, setAck] = useState(false)
  const [done, setDone] = useState<Done | null>(null)
  const [pending, start] = useTransition()

  const depts = useMemo(() => [...new Set(rows.map((r) => r.department))].sort(), [rows])
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => (!dept || r.department === dept) && (!needle || r.no.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle)))
  }, [rows, q, dept])
  const allShown = shown.length > 0 && shown.every((r) => sel.has(r.id))

  // the passwords only exist on this screen: warn before the page is closed or reloaded
  useEffect(() => {
    if (!done) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [done])

  function toggleAll() {
    setSel((s) => {
      const n = new Set(s)
      if (allShown) shown.forEach((r) => n.delete(r.id))
      else shown.forEach((r) => n.add(r.id))
      return n
    })
  }
  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  function review() {
    start(async () => {
      const r = await previewLogins([...sel], roleId)
      if ("error" in r) return void toast.error(r.error)
      setAck(false)
      setPrev(r)
    })
  }
  function confirm() {
    start(async () => {
      const r = await createLogins([...sel], roleId)
      if ("error" in r) {
        setPrev(null)
        return void toast.error(r.error)
      }
      setPrev(null)
      setSel(new Set())
      setDone(r)
      toast.success(t("bl.created", { n: r.created.length }))
    })
  }
  function download() {
    if (!done) return
    const bin = atob(done.xlsx)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `logins-${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }
  function printSlips() {
    if (!done) return
    const w = window.open("", "_blank")
    if (!w) return void toast.error(t("bl.popup"))
    const site = window.location.origin
    const slips = done.created
      .map(
        (c) => `<div class="s"><b>${esc(c.name)}</b><div class="m">${esc(t("bl.col.no"))}: ${esc(c.employeeNo)}</div>
<div>${esc(t("bl.slip.site"))}: <span class="v">${esc(site)}</span></div>
<div>${esc(t("bl.col.username"))}: <span class="v">${esc(c.username)}</span></div>
<div>${esc(t("bl.col.password"))}: <span class="v">${esc(c.password)}</span></div>
<div class="m">${esc(t("bl.slip.note", { days }))}</div></div>`,
      )
      .join("")
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(t("bl.slips"))}</title><style>
body{font:13px system-ui,sans-serif;margin:12mm}.g{display:grid;grid-template-columns:1fr 1fr;gap:6mm}
.s{border:1px dashed #666;border-radius:4px;padding:4mm;break-inside:avoid;line-height:1.7}.v{font:600 14px ui-monospace,monospace}.m{color:#555;font-size:11px}
@media print{body{margin:6mm}}</style><div class="g">${slips}</div>`)
    w.document.close()
    w.focus()
    w.print()
  }
  function finish() {
    setDone(null)
    router.refresh()
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-emerald-600/30 bg-emerald-500/10 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">{t("bl.created", { n: done.created.length })}</p>
            <p className="text-muted-foreground">{t("bl.once", { days })}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={download}>
            <Download className="size-4" /> {t("bl.download")}
          </Button>
          <Button variant="outline" onClick={printSlips}>
            <Printer className="size-4" /> {t("bl.print")}
          </Button>
          <Button variant="ghost" onClick={finish}>
            {t("bl.done")}
          </Button>
        </div>
        {done.skipped.length > 0 && <SkipList list={done.skipped} />}
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("bl.col.no")}</TableHead>
                <TableHead>{t("bl.col.name")}</TableHead>
                <TableHead>{t("bl.col.username")}</TableHead>
                <TableHead>{t("bl.col.password")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {done.created.map((c) => (
                <TableRow key={c.username}>
                  <TableCell>{c.employeeNo}</TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell className="font-mono">{c.username}</TableCell>
                  <TableCell className="font-mono">{c.password}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  const over = sel.size > max
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("bl.search")} className="w-56" />
        <select value={dept} onChange={(e) => setDept(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm" aria-label={t("bl.dept")}>
          <option value="">{t("bl.allDept")}</option>
          {depts.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          {t("bl.role")}
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className={over ? "text-destructive" : "text-muted-foreground"}>{over ? t("bl.over", { max }) : t("bl.selected", { n: sel.size })}</span>
          <Button disabled={sel.size === 0 || over || pending || !roleId} onClick={review}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} {t("bl.review")}
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">{t("bl.none")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allShown} onCheckedChange={toggleAll} aria-label={t("bl.selectAll")} />
                </TableHead>
                <TableHead>{t("bl.col.no")}</TableHead>
                <TableHead>{t("bl.col.name")}</TableHead>
                <TableHead>{t("bl.dept")}</TableHead>
                <TableHead>{t("bl.desig")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={r.id} data-state={sel.has(r.id) ? "selected" : undefined} onClick={() => toggle(r.id)} className="cursor-pointer">
                  <TableCell>
                    <Checkbox checked={sel.has(r.id)} onCheckedChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} aria-label={r.name} />
                  </TableCell>
                  <TableCell>{r.no}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.department}</TableCell>
                  <TableCell>{r.designation}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={prev !== null} onOpenChange={(o) => !o && !pending && setPrev(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("bl.confirmTitle")}</DialogTitle>
            <DialogDescription>{prev && t("bl.confirmBody", { n: prev.count, role: prev.role })}</DialogDescription>
          </DialogHeader>
          {prev && (
            <div className="space-y-3 text-sm">
              {prev.sample.length > 0 && <p className="text-muted-foreground">{t("bl.sample", { list: prev.sample.join(", ") })}</p>}
              {prev.skipped.length > 0 && <SkipList list={prev.skipped} />}
              {prev.count === 0 ? (
                <p className="text-destructive">{t("bl.err.nothing")}</p>
              ) : (
                <label className="flex items-start gap-2">
                  <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" />
                  <span>{t("bl.ack", { days })}</span>
                </label>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setPrev(null)}>
              {t("common.cancel")}
            </Button>
            <Button disabled={!prev || prev.count === 0 || !ack || pending} onClick={confirm}>
              {pending && <Loader2 className="size-4 animate-spin" />} {t("bl.confirm", { n: prev?.count ?? 0 })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SkipList({ list }: { list: Prev["skipped"] }) {
  const t = useT()
  return (
    <details className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        <TriangleAlert className="size-4 text-amber-600" /> {t("bl.skipped", { n: list.length })}
      </summary>
      <ul className="mt-2 max-h-40 space-y-0.5 overflow-auto">
        {list.map((s, i) => (
          <li key={i}>
            {s.employeeNo} {s.name}: <span className="text-muted-foreground">{t(`bl.skip.${s.reason}`)}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
