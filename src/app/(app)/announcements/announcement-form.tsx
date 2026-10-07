"use client"

import { useRef, useState, useTransition } from "react"
import { Loader2, Megaphone, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/i18n/provider"
import { deleteAnnouncement, publishAnnouncement } from "./actions"

export type AnnouncementRow = { id: string; title: string; body: string; when: string; expires: string | null; author: string; telegram: boolean; active: boolean }

export function AnnouncementForm({ telegramReady }: { telegramReady: boolean }) {
  const t = useT()
  const form = useRef<HTMLFormElement>(null)
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  return (
    <form
      ref={form}
      className="space-y-4 rounded-xl border p-5"
      action={(fd) =>
        start(async () => {
          const r = await publishAnnouncement(fd)
          if (r.error) return setErr(r.error)
          setErr(null)
          form.current?.reset()
          toast.success(t("ann.published"))
          if (r.telegram === "sent") toast.success(t("ann.tgSent"))
          if (r.telegram === "failed") toast.error(t("ann.tgFailed"))
        })
      }
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Megaphone className="size-4 text-primary" /> {t("ann.new")}
      </h2>
      <div className="space-y-1.5">
        <Label htmlFor="a-title">{t("ann.title")}</Label>
        <Input id="a-title" name="title" maxLength={120} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="a-body">{t("ann.body")}</Label>
        <Textarea id="a-body" name="body" rows={4} maxLength={2000} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="a-exp">{t("ann.expires")}</Label>
          <Input id="a-exp" name="expires" type="date" />
          <p className="text-xs text-muted-foreground">{t("ann.expiresHint")}</p>
        </div>
        <label className={`flex items-start gap-2.5 self-end text-sm ${telegramReady ? "" : "opacity-50"}`}>
          <input type="checkbox" name="telegram" defaultChecked={telegramReady} disabled={!telegramReady} className="mt-0.5 size-4 accent-[var(--primary)]" />
          <span>
            {t("ann.alsoTelegram")}
            {!telegramReady && <span className="block text-xs text-muted-foreground">{t("ann.tgOff")}</span>}
          </span>
        </label>
      </div>
      {err && (
        <p role="alert" className="text-sm text-destructive">
          {err}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} {t("ann.publish")}
      </Button>
    </form>
  )
}

export function AnnouncementList({ rows }: { rows: AnnouncementRow[] }) {
  const t = useT()
  const [pending, start] = useTransition()
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t("ann.none")}</p>
  return (
    <ul className="space-y-3">
      {rows.map((a) => (
        <li key={a.id} className={`rounded-xl border p-4 ${a.active ? "" : "opacity-60"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{a.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {a.when} · {a.author}
                {a.telegram && ` · ${t("ann.inTelegram")}`}
                {a.expires && ` · ${a.active ? t("ann.until", { date: a.expires }) : t("ann.expired")}`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              aria-label={t("common.delete")}
              onClick={() => {
                if (!window.confirm(t("ann.deleteConfirm"))) return
                start(async () => {
                  await deleteAnnouncement(a.id)
                  toast.success(t("md.deleted"))
                })
              }}
            >
              <Trash2 />
            </Button>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm">{a.body}</p>
        </li>
      ))}
    </ul>
  )
}
