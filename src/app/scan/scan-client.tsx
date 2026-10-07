"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, Loader2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { punchByQr, type PunchResult } from "./actions"
import { useT } from "@/i18n/provider"

type Geo = { lat: number; lng: number; accuracy: number }

function getPosition(t: (key: string) => string): Promise<Geo> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error(t("scan.geo.unsupported")))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(e.code === e.PERMISSION_DENIED ? t("scan.geo.denied") : t("scan.geo.failed"))),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 },
    )
  })
}

export function ScanClient({ token, suggested, location, needsGeo }: { token: string; suggested: "IN" | "OUT"; location: string; needsGeo: boolean }) {
  const t = useT()
  const [type, setType] = useState<"IN" | "OUT">(suggested)
  const [result, setResult] = useState<PunchResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, start] = useTransition()

  async function confirm() {
    setBusy(true)
    setResult(null)
    try {
      const geo = needsGeo ? await getPosition(t) : null
      start(async () => {
        setResult(await punchByQr(token, type, geo))
        setBusy(false)
      })
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message })
      setBusy(false)
    }
  }

  if (result?.ok)
    return (
      <div role="status" className="flex flex-col items-center gap-2 rounded-2xl border border-green-500/40 bg-green-500/10 p-8 text-center">
        <CheckCircle2 className="size-12 text-green-600 dark:text-green-400" />
        <p className="text-xl font-semibold">{result.type === "IN" ? t("scan.checkedIn") : t("scan.checkedOut")}</p>
        <p className="tabular-nums text-muted-foreground">
          {new Date(result.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Phnom_Penh" })} · {result.location}
        </p>
      </div>
    )

  return (
    <div className="space-y-4 rounded-2xl border p-5">
      <div>
        <p className="text-sm text-muted-foreground">{t("form.location")}</p>
        <p className="flex items-center gap-1.5 font-medium">
          <MapPin className="size-4 text-primary" />
          {location}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("att.type")}>
        {(["IN", "OUT"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setType(k)}
            aria-pressed={type === k}
            className={cn("rounded-lg border px-3 py-3 text-sm font-medium transition-colors", type === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            {k === "IN" ? t("att.checkIn") : t("att.checkOut")}
          </button>
        ))}
      </div>
      <Button size="lg" className="h-12 w-full text-base" onClick={confirm} disabled={busy || pending}>
        {(busy || pending) && <Loader2 className="animate-spin" />}
        {type === "IN" ? t("scan.confirmIn") : t("scan.confirmOut")}
      </Button>
      {needsGeo && <p className="text-xs text-muted-foreground">{t("scan.geoNote")}</p>}
      {result && !result.ok && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {result.error}
        </p>
      )}
    </div>
  )
}
