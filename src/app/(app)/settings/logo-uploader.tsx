"use client"

import { useRef, useState, useTransition } from "react"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/provider"
import { removeCompanyLogo, saveCompanyLogo } from "./actions"

export function LogoUploader({ logoUrl, defaultLogo, canEdit }: { logoUrl: string | null; defaultLogo: string; canEdit: boolean }) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const shown = preview ?? logoUrl

  function upload(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setErr(t("form.photoSize"))
      return
    }
    setErr(null)
    setPreview(URL.createObjectURL(file))
    const fd = new FormData()
    fd.set("logo", file)
    start(async () => {
      const r = await saveCompanyLogo(fd)
      if (r.error) {
        setErr(r.error)
        setPreview(null)
      } else {
        toast.success(t("set.logo.saved"))
      }
    })
  }

  return (
    <section className="max-w-xl space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{t("set.logo")}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("set.logo.hint")}</p>
      </div>
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shown ?? defaultLogo} alt="" className={`size-20 rounded-2xl bg-white object-contain p-1 ring-1 ring-border ${shown ? "" : "opacity-70"}`} />
        {canEdit ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => input.current?.click()}>
                {pending ? <Loader2 className="animate-spin" /> : <ImagePlus />} {shown ? t("set.logo.replace") : t("set.logo.upload")}
              </Button>
              {shown && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await removeCompanyLogo()
                      setPreview(null)
                      toast.success(t("set.logo.removed"))
                    })
                  }
                >
                  <Trash2 /> {t("set.logo.remove")}
                </Button>
              )}
            </div>
            {!shown && <p className="text-xs text-muted-foreground">{t("set.logo.none")}</p>}
            {err && (
              <p role="alert" className="text-xs text-destructive">
                {err}
              </p>
            )}
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) upload(f)
                e.target.value = ""
              }}
            />
          </div>
        ) : (
          !shown && <p className="text-xs text-muted-foreground">{t("set.logo.none")}</p>
        )}
      </div>
    </section>
  )
}
