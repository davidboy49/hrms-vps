import type { RateBasis } from "@prisma/client"

/** Device clocks and display times use this zone (Cambodia has no DST: UTC+7). */
export const APP_TZ = "Asia/Phnom_Penh"
export const TZ_OFFSET_H = 7

type D = Date | string | null | undefined

// Numeric dd/mm/yyyy reads the same in Khmer and English, and matches local convention.
// @db.Date values are UTC midnight, so those are formatted in UTC to avoid off-by-one days.
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: APP_TZ })
const dtFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: APP_TZ })

export const fmtDate = (d: D) => (d ? dateFmt.format(new Date(d)) : "—")
export const fmtTime = (d: D) => (d ? timeFmt.format(new Date(d)) : "—")
export const fmtDateTime = (d: D) => (d ? dtFmt.format(new Date(d)).replace(",", "") : "—")

/** Translation keys for the unit shown after a rate, e.g. "$450 / mo". */
export const BASIS_KEY: Record<RateBasis, string> = { MONTH: "basis.short.MONTH", DAY: "basis.short.DAY", HOUR: "basis.short.HOUR" }

export function fmtRate(amount: unknown, basis: RateBasis, currency: string, unit?: string) {
  const n = Number(amount)
  const sym = currency === "USD" ? "$" : currency === "KHR" ? "៛" : currency + " "
  const val = n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return `${sym}${val} / ${unit ?? basis.toLowerCase()}`
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("")

/** Form date string (yyyy-mm-dd) to a Date at UTC midnight, safe for @db.Date */
export const toDate = (s: string | null | undefined) => (s ? new Date(s + "T00:00:00.000Z") : null)
export const toInput = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "")

/** yyyy-mm-dd of an instant, in the app time zone */
export const localDateKey = (d: Date) => new Date(d.getTime() + TZ_OFFSET_H * 3600_000).toISOString().slice(0, 10)
/** minutes since local midnight, in the app time zone */
export const localMinutes = (d: Date) => {
  const t = new Date(d.getTime() + TZ_OFFSET_H * 3600_000)
  return t.getUTCHours() * 60 + t.getUTCMinutes()
}
/** "2026-10-06" + "08:30" (device local time) to a real instant */
export const fromLocal = (dateKey: string, hhmm: string) => new Date(`${dateKey}T${hhmm}:00.000+07:00`)
