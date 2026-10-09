"use client"

import { useState, useTransition } from "react"
import { Loader2, Search, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/native-select"
import { useT } from "@/i18n/provider"
import { findTelegramChats, saveTelegram, testTelegram } from "./telegram-actions"

export type TgView = { hasToken: boolean; chatId: string; enabled: boolean; lang: "km" | "en"; flags: { late: boolean; far: boolean; missing: boolean; announce: boolean; punch: boolean; leave: boolean } }

export function TelegramForm({ cfg }: { cfg: TgView }) {
  const t = useT()
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [chatId, setChatId] = useState(cfg.chatId)
  const [chats, setChats] = useState<{ id: number; title: string; type: string }[] | null>(null)
  const [clear, setClear] = useState(false)

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-lg border bg-muted/40 p-4 text-sm">
        <p className="font-medium">{t("tg.howTitle")}</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>{t("tg.how1")}</li>
          <li>{t("tg.how2")}</li>
          <li>{t("tg.how3")}</li>
          <li>{t("tg.how4")}</li>
        </ol>
      </div>

      <form
        className="space-y-5"
        action={(fd) => {
          fd.set("chatId", chatId)
          fd.set("clearToken", clear ? "1" : "0")
          start(async () => {
            const r = await saveTelegram(fd)
            if (r.error) setErr(r.error)
            else {
              setErr(null)
              setClear(false)
              toast.success(r.bot ? t("tg.savedBot", { bot: `@${r.bot}` }) : t("set.saved"))
            }
          })
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="tg-token">{t("tg.token")}</Label>
          <Input id="tg-token" name="token" type="password" autoComplete="off" placeholder={cfg.hasToken ? "••••••••••  " + t("tg.tokenSaved") : "123456789:AA…"} />
          <p className="text-xs text-muted-foreground">{t("tg.tokenHint")}</p>
          {cfg.hasToken && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" className="size-3.5 accent-[var(--primary)]" checked={clear} onChange={(e) => setClear(e.target.checked)} /> {t("tg.clearToken")}
            </label>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tg-chat">{t("tg.chatId")}</Label>
          <div className="flex gap-2">
            <Input id="tg-chat" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="-1001234567890" className="font-mono" />
            <Button
              type="button"
              variant="outline"
              disabled={pending || !cfg.hasToken}
              onClick={() =>
                start(async () => {
                  const r = await findTelegramChats()
                  if (r.error) setErr(r.error)
                  else {
                    setErr(null)
                    setChats(r.chats ?? [])
                  }
                })
              }
            >
              <Search /> {t("tg.find")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("tg.chatHint")}</p>
          {chats && (
            <ul className="divide-y rounded-lg border text-sm">
              {chats.length === 0 && <li className="p-3 text-muted-foreground">{t("tg.noChats")}</li>}
              {chats.map((c) => (
                <li key={c.id}>
                  <button type="button" className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted" onClick={() => setChatId(String(c.id))}>
                    <span className="truncate">{c.title}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {c.type} · {c.id}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tg-lang">{t("tg.lang")}</Label>
          <NativeSelect id="tg-lang" name="lang" defaultValue={cfg.lang}>
            <option value="km">ភាសាខ្មែរ</option>
            <option value="en">English</option>
          </NativeSelect>
        </div>

        <fieldset className="space-y-2.5 rounded-lg border p-4">
          <legend className="px-1 text-sm font-medium">{t("tg.send")}</legend>
          {(
            [
              ["late", "tg.late", "tg.lateHint"],
              ["far", "tg.far", "tg.farHint"],
              ["missing", "tg.missing", "tg.missingHint"],
              ["announce", "tg.announce", "tg.announceHint"],
              ["leave", "tg.leave", "tg.leaveHint"],
              ["punch", "tg.punch", "tg.punchHint"],
            ] as const
          ).map(([k, label, hint]) => (
            <label key={k} className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" name={k} defaultChecked={cfg.flags[k]} className="mt-0.5 size-4 accent-[var(--primary)]" />
              <span>
                {t(label)}
                <span className="block text-xs text-muted-foreground">{t(hint)}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input type="checkbox" name="enabled" defaultChecked={cfg.enabled} className="size-4 accent-[var(--primary)]" /> {t("tg.enabled")}
        </label>

        {err && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />} {t("common.save")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending || !cfg.hasToken || !cfg.chatId}
            onClick={() =>
              start(async () => {
                const r = await testTelegram()
                if (r.error) setErr(r.error)
                else {
                  setErr(null)
                  toast.success(t("tg.testSent"))
                }
              })
            }
          >
            <Send /> {t("tg.test")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("tg.testNote")}</p>
      </form>
    </div>
  )
}
