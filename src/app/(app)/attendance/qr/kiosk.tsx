"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import QRCode from "qrcode"
import { toast } from "sonner"
import { Maximize2, MapPin, Printer, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/native-select"
import { getQrToken, regenerateQr } from "./actions"
import { useT } from "@/i18n/provider"

const REFRESH_MS = 15_000
const WINDOW_MS = 30_000

type Loc = { id: string; name: string; geofenced: boolean; mode: "STATIC" | "ROTATING" }

export function QrKiosk({ locations }: { locations: Loc[] }) {
  const t = useT()
  const [locId, setLocId] = useState(locations[0]?.id ?? "")
  const [error, setError] = useState<string | null>(null)
  const [left, setLeft] = useState(WINDOW_MS / 1000)
  const [pending, start] = useTransition()
  const canvas = useRef<HTMLCanvasElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const loc = locations.find((l) => l.id === locId)
  const isStatic = loc?.mode === "STATIC"

  const errMsg = t("qr.err")
  const refresh = useCallback(async () => {
    if (!locId || !canvas.current) return
    try {
      const token = await getQrToken(locId)
      const url = `${window.location.origin}/scan?t=${encodeURIComponent(token)}`
      await QRCode.toCanvas(canvas.current, url, { width: 360, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0b2e2a", light: "#ffffff" } })
      setError(null)
      setLeft(REFRESH_MS / 1000)
    } catch {
      setError(errMsg)
    }
  }, [locId, errMsg])

  // a printed code is drawn once; a rotating one is redrawn every few seconds
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
    if (isStatic) return
    const timer = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(timer)
  }, [refresh, isStatic])

  useEffect(() => {
    if (isStatic) return
    const timer = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [isStatic])

  if (locations.length === 0)
    return <p className="rounded-lg border p-6 text-sm text-muted-foreground">{t("qr.noLocations")}</p>

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center gap-2">
        <NativeSelect value={locId} onChange={(e) => setLocId(e.target.value)} aria-label={t("form.location")}>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </NativeSelect>
        <Button variant="outline" onClick={() => stage.current?.requestFullscreen?.().catch(() => {})} aria-label={t("qr.fullscreen")}>
          <Maximize2 /> {t("qr.fullscreen")}
        </Button>
      </div>

      {isStatic && !loc?.geofenced && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {t("qr.static.noCoords")}
        </p>
      )}

      <div ref={stage} className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-6 text-center fullscreen:justify-center fullscreen:bg-background">
        <p className="text-lg font-semibold">{loc?.name}</p>
        <div className="relative rounded-xl bg-white p-2 shadow-sm">
          <canvas ref={canvas} className="size-[min(72vw,360px)]" aria-label={t("qr.aria")} />
        </div>
        {!isStatic && (
          <div className="w-full max-w-[360px] space-y-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear" style={{ width: `${(left / (REFRESH_MS / 1000)) * 100}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{t("qr.newIn", { n: left })}</p>
          </div>
        )}
        <p className="text-sm text-muted-foreground">{t("qr.steps")}</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {isStatic && (
        <div className="flex flex-wrap gap-2">
          <Button render={<a href={`/print/qr/${locId}`} target="_blank" rel="noopener" />}>
            <Printer /> {t("qr.static.print")}
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(t("qr.static.regenConfirm"))) return
              start(async () => {
                await regenerateQr(locId)
                await refresh()
                toast.success(t("qr.static.regenDone"))
              })
            }}
          >
            <RefreshCw /> {t("qr.static.regen")}
          </Button>
        </div>
      )}

      <ul className="space-y-1.5 text-xs text-muted-foreground">
        <li className="flex items-center gap-2">
          <ShieldCheck className="size-3.5 shrink-0" /> {isStatic ? t("qr.static.note") : t("qr.rotates")}
        </li>
        <li className="flex items-center gap-2">
          <MapPin className="size-3.5 shrink-0" />
          {loc?.geofenced ? t("qr.geoOn") : t("qr.geoOff")}
        </li>
      </ul>
    </div>
  )
}
