"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { ArrowDown, ArrowUp, ChevronsUpDown, MoreHorizontal, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pager } from "@/components/pager"
import { PersonAvatar } from "@/components/avatar"
import { StatusBadge } from "@/components/status-badge"
import { useQueryParams } from "@/lib/use-query-params"
import { useT } from "@/i18n/provider"
import { deleteEmployees } from "./actions"

export type Row = {
  id: string
  employeeNo: string
  name: string
  photoUrl: string | null
  designation: string
  department: string
  joining: string
  contract: string
  contractEnd: string | null
  rate: string
  statusName: string
  statusColor: string
}

const COLS: { key: string; label: string; sort?: string; right?: boolean; rate?: boolean }[] = [
  { key: "employee", label: "emp.employee", sort: "nameEn" },
  { key: "designation", label: "emp.designation", sort: "designation" },
  { key: "department", label: "emp.department", sort: "department" },
  { key: "joining", label: "emp.joining", sort: "joiningDate" },
  { key: "contract", label: "emp.contract", sort: "contract" },
  { key: "rate", label: "emp.rate", sort: "rateAmount", right: true, rate: true },
  { key: "status", label: "emp.status", sort: "status" },
]

export function EmployeeTable({
  rows,
  total,
  page,
  size,
  sort,
  dir,
  canEdit,
  showRate,
  canExport,
}: {
  rows: Row[]
  total: number
  page: number
  size: number
  sort: string
  dir: string
  canEdit: boolean
  showRate: boolean
  canExport: boolean
}) {
  const t = useT()
  const { set } = useQueryParams()
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState<string[] | null>(null)
  const [pending, start] = useTransition()

  const allOn = rows.length > 0 && rows.every((r) => sel.has(r.id))
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  function sortBy(key: string) {
    if (sort === key) set({ sort: key, dir: dir === "asc" ? "desc" : "asc" }, false)
    else set({ sort: key, dir: "asc" }, false)
  }

  function doDelete() {
    const ids = confirm ?? []
    start(async () => {
      const r = await deleteEmployees(ids)
      toast.success(t("emp.deleted", { n: r.count }))
      setSel(new Set())
      setConfirm(null)
    })
  }



  const exportSel = () => {
    const p = new URLSearchParams()
    p.set("ids", [...sel].join(","))
    p.set("format", "xlsx")
    return `/employees/export?${p.toString()}`
  }

  return (
    <div className="rounded-lg border">
      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{t("common.nSelected", { n: sel.size })}</span>
          {canExport && (
            <Button size="sm" variant="outline" render={<a href={exportSel()} />}>
              {t("emp.exportSelected")}
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="destructive" onClick={() => setConfirm([...sel])}>
              <Trash2 /> {t("common.delete")}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>
            <X /> {t("common.clear")}
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-10">
              <Checkbox checked={allOn} onCheckedChange={(c) => setSel(c ? new Set(rows.map((r) => r.id)) : new Set())} aria-label={t("table.selectAll")} />
            </TableHead>
            <TableHead className="w-12 font-mono text-[11px] uppercase tracking-wide">{t("table.no")}</TableHead>
            {COLS.filter((c) => showRate || !c.rate).map((c) => (
              <TableHead key={c.key} className={c.right ? "text-right" : undefined}>
                <button onClick={() => sortBy(c.sort!)} className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide hover:text-foreground">
                  {t(c.label)}
                  {sort === c.sort ? dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-40" />}
                </button>
              </TableHead>
            ))}
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={11} className="h-32 text-center text-muted-foreground">
                {t("emp.noMatch")}
              </TableCell>
            </TableRow>
          )}
          {rows.map((r, i) => (
            <TableRow key={r.id} data-state={sel.has(r.id) ? "selected" : undefined}>
              <TableCell>
                <Checkbox checked={sel.has(r.id)} onCheckedChange={() => toggle(r.id)} aria-label={t("table.select", { name: r.name })} />
              </TableCell>
              <TableCell className="font-mono text-muted-foreground tabular-nums">{(page - 1) * size + i + 1}</TableCell>
              <TableCell>
                <Link href={`/employees/${r.id}`} className="flex items-center gap-2.5 hover:underline">
                  <PersonAvatar name={r.name} url={r.photoUrl} />
                  <span className="leading-tight">
                    <span className="block font-medium">{r.name}</span>
                    <span className="text-xs text-muted-foreground">{r.employeeNo}</span>
                  </span>
                </Link>
              </TableCell>
              <TableCell>{r.designation}</TableCell>
              <TableCell>{r.department}</TableCell>
              <TableCell className="whitespace-nowrap">{r.joining}</TableCell>
              <TableCell className="whitespace-nowrap">
                {r.contract}
                {r.contractEnd && <span className="text-muted-foreground"> · {r.contractEnd}</span>}
              </TableCell>
              {showRate && <TableCell className="whitespace-nowrap text-right tabular-nums">{r.rate}</TableCell>}
              <TableCell>
                <StatusBadge name={r.statusName} color={r.statusColor} />
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t("table.actionsFor", { name: r.name })} />}>
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem render={<Link href={`/employees/${r.id}`} />}>{t("common.view")}</DropdownMenuItem>
                    {canEdit && <DropdownMenuItem render={<Link href={`/employees/${r.id}/edit`} />}>{t("common.edit")}</DropdownMenuItem>}
                    {canEdit && <DropdownMenuSeparator />}
                    {canEdit && (
                      <DropdownMenuItem variant="destructive" onClick={() => setConfirm([r.id])}>
                        {t("common.delete")}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Pager total={total} page={page} size={size} />

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.length === 1 ? t("emp.deleteOne") : t("emp.deleteMany", { n: confirm?.length ?? 0 })}</DialogTitle>
            <DialogDescription>{t("emp.deleteNote")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={doDelete} disabled={pending}>
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
