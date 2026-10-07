"use client"

import { useRef, useState, useTransition } from "react"
import { CheckCircle2, Download, FileSpreadsheet, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ImportResult } from "@/lib/employee-io"
import { importEmployees } from "./import-action"
import { useT } from "@/i18n/provider"

export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT()
  const [file, setFile] = useState<File | null>(null)
  const [res, setRes] = useState<ImportResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const input = useRef<HTMLInputElement>(null)

  function reset() {
    setFile(null)
    setRes(null)
    setErr(null)
    if (input.current) input.current.value = ""
  }
  function run(commit: boolean) {
    if (!file) return
    const fd = new FormData()
    fd.set("file", file)
    fd.set("commit", commit ? "1" : "0")
    start(async () => {
      const r = await importEmployees(fd)
      if ("error" in r) {
        setErr(r.error)
        setRes(null)
        return
      }
      setErr(null)
      setRes(r)
      if (commit && r.created) {
        toast.success(t("import.done", { n: r.created }))
        onOpenChange(false)
        reset()
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("import.title")}</DialogTitle>
          <DialogDescription>{t("import.desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <Button variant="outline" size="sm" render={<a href="/employees/template" />}>
            <Download /> {t("import.template")}
          </Button>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted/40">
            <FileSpreadsheet className="size-6" />
            {file ? <span className="font-medium text-foreground">{file.name}</span> : <span>{t("import.choose")}</span>}
            <input
              ref={input}
              type="file"
              accept=".xlsx"
              className="sr-only"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setRes(null)
                setErr(null)
              }}
            />
          </label>

          {err && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </p>
          )}

          {res && (
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                {res.issues.length === 0 ? <CheckCircle2 className="size-4 text-green-600" /> : <TriangleAlert className="size-4 text-amber-600" />}
                {t("import.summary", { total: res.total, valid: res.valid, errors: res.issues.length })}
              </p>
              {res.issues.length > 0 && (
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2 text-xs">
                  {res.issues.slice(0, 100).map((i) => (
                    <li key={i.row}>
                      <span className="font-mono text-muted-foreground">{t("import.row", { n: i.row })}</span> {i.message}
                    </li>
                  ))}
                </ul>
              )}
              {res.issues.length > 0 && <p className="text-muted-foreground">{t("import.fix")}</p>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
          <Button variant="outline" disabled={!file || pending} onClick={() => run(false)}>
            {t("import.check")}
          </Button>
          <Button disabled={!file || pending || !res || res.issues.length > 0 || res.valid === 0} onClick={() => run(true)}>
            {t("common.import")} {res && res.valid > 0 && res.issues.length === 0 ? res.valid : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
