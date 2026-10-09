"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, UserCheck, UserMinus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { MIN_NOTE } from "@/lib/employment"
import { deactivateEmployee, reactivateEmployee } from "./status-actions"
import { useT } from "@/i18n/provider"

export type StatusOpt = { value: string; label: string }
export type Who = { id: string; name: string; no: string; hasLogin: boolean }

/** Deactivate (someone leaves) or reactivate (they come back). Both need a reason of at least 20 characters. */
export function StatusDialog({ open, onOpenChange, mode, who, statuses, today }: { open: boolean; onOpenChange: (o: boolean) => void; mode: "deactivate" | "reactivate"; who: Who; statuses: StatusOpt[]; today: string }) {
  const t = useT()
  const router = useRouter()
  const [statusId, setStatusId] = useState(statuses[0]?.value ?? "")
  const [date, setDate] = useState(today)
  const [note, setNote] = useState("")
  const [login, setLogin] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const deact = mode === "deactivate"
  const len = [...note.trim()].length
  const ready = len >= MIN_NOTE && statusId !== "" && date !== ""

  function submit() {
    setErr(null)
    start(async () => {
      const r = deact ? await deactivateEmployee(who.id, { statusId, date, note }) : await reactivateEmployee(who.id, { statusId, date, note, enableLogin: login })
      if ("error" in r) return setErr(r.error)
      toast.success(t(deact ? "emp.deact.done" : "emp.react.done", { name: who.name }))
      onOpenChange(false)
      setNote("")
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(deact ? "emp.deact.title" : "emp.react.title", { name: who.name })}</DialogTitle>
          <DialogDescription>{t(deact ? "emp.deact.intro" : "emp.react.intro", { name: who.name, no: who.no })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="st-status">{t(deact ? "emp.deact.reason" : "emp.react.status")}</Label>
              <select id="st-status" value={statusId} onChange={(e) => setStatusId(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2">
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-date">{t(deact ? "emp.deact.lastDay" : "emp.react.date")}</Label>
              <input id="st-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="st-note">{t(deact ? "emp.deact.note" : "emp.react.note", { min: MIN_NOTE })}</Label>
            <Textarea id="st-note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
            <p className={`text-xs ${len >= MIN_NOTE ? "text-muted-foreground" : "text-destructive"}`}>{t("emp.count", { n: len, min: MIN_NOTE })}</p>
          </div>
          {deact ? (
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>{t(who.hasLogin ? "emp.deact.e1" : "emp.deact.e1none")}</li>
              <li>{t("emp.deact.e2")}</li>
              <li>{t("emp.deact.e3")}</li>
              <li>{t("emp.deact.e4")}</li>
            </ul>
          ) : (
            who.hasLogin && (
              <label className="flex items-center gap-2">
                <Checkbox checked={login} onCheckedChange={(v) => setLogin(v === true)} /> {t("emp.react.login")}
              </label>
            )
          )}
          {err && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-destructive">
              {err}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant={deact ? "destructive" : "default"} disabled={!ready || pending} onClick={submit}>
            {pending && <Loader2 className="size-4 animate-spin" />} {t(deact ? "emp.deact.confirm" : "emp.react.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The Deactivate / Reactivate button for the employee profile page. */
export function StatusButton({ mode, who, statuses, today }: { mode: "deactivate" | "reactivate"; who: Who; statuses: StatusOpt[]; today: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={mode === "deactivate" ? "outline" : "default"} onClick={() => setOpen(true)}>
        {mode === "deactivate" ? <UserMinus /> : <UserCheck />} {t(mode === "deactivate" ? "emp.deactivate" : "emp.reactivate")}
      </Button>
      {open && <StatusDialog open={open} onOpenChange={setOpen} mode={mode} who={who} statuses={statuses} today={today} />}
    </>
  )
}
