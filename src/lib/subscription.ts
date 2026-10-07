import { db } from "@/lib/db"
import { APP_TZ } from "@/lib/format"

export const SUBSCRIPTION_KEY = "subscription.endsAt"
/** The banner starts this many days before the end date. */
export const WARN_DAYS = 30

export type Subscription =
  | { state: "none" }
  | { state: "ok" | "soon" | "last" | "expired"; endsAt: string; daysLeft: number }

const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ })
const dayNum = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86_400_000

/**
 * Reads the end date (YYYY-MM-DD, last day of service, Phnom Penh time).
 * It is not an editable setting: the customer's admin cannot extend it, only `npm run sub:set` can.
 * No date stored = no banner, so existing installs keep working.
 */
export async function getSubscription(): Promise<Subscription> {
  const row = await db.setting.findUnique({ where: { key: SUBSCRIPTION_KEY } })
  const endsAt = row?.value.trim()
  if (!endsAt || !/^\d{4}-\d{2}-\d{2}$/.test(endsAt)) return { state: "none" }
  const daysLeft = dayNum(endsAt) - dayNum(ymd.format(new Date()))
  const state = daysLeft < 0 ? "expired" : daysLeft === 0 ? "last" : daysLeft <= WARN_DAYS ? "soon" : "ok"
  return { state, endsAt, daysLeft }
}
