import { headers } from "next/headers"
import QRCode from "qrcode"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/session"
import { makeStaticToken } from "@/lib/qr"
import { dictFor } from "@/i18n/server"
import { PrintButton } from "./print-button"

export const dynamic = "force-dynamic"
export const metadata = { title: "QR poster" }

/** A printable poster for the entrance. It is written in Khmer and English so every employee can read it. */
export default async function QrPoster({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("HR")
  const { id } = await params
  const loc = await db.location.findUnique({ where: { id } })
  const km = dictFor("km")
  const en = dictFor("en")

  if (!loc || loc.qrMode !== "STATIC")
    return <p className="p-8 text-sm">{en["poster.notStatic"]}</p>

  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const url = `${proto}://${host}/scan?t=${encodeURIComponent(makeStaticToken(loc.id, loc.qrVersion))}`
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: 520, errorCorrectionLevel: "M", color: { dark: "#0b2e2a", light: "#ffffff" } })

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col items-center justify-center gap-6 bg-white p-8 text-center text-black">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold leading-snug">{km["poster.title"]}</h1>
        <p className="text-2xl font-semibold">{en["poster.title"]}</p>
      </div>
      <div className="w-full max-w-[520px] rounded-2xl border-4 border-black p-3" dangerouslySetInnerHTML={{ __html: svg }} aria-label="QR" />
      <p className="text-3xl font-bold">{loc.name}</p>
      <div className="space-y-1 text-lg">
        <p>{km["poster.steps"]}</p>
        <p className="text-base text-neutral-600">{en["poster.steps"]}</p>
      </div>
      <PrintButton label={en["poster.print"]} />
    </main>
  )
}
