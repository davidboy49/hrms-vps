import { TriangleAlert } from "lucide-react"
import { getSubscription } from "@/lib/subscription"
import { fmtDate } from "@/lib/format"
import { getT } from "@/i18n/server"

/** Shown to Admin and HR when the subscription is within 30 days of ending, or has ended. */
export async function SubscriptionBanner() {
  const sub = await getSubscription()
  if (sub.state === "none" || sub.state === "ok") return null
  const t = await getT()
  const date = fmtDate(sub.endsAt)
  const bad = sub.state === "expired" || sub.state === "last"
  const text =
    sub.state === "expired"
      ? t("sub.expired", { date })
      : sub.state === "last"
        ? t("sub.lastDay", { date })
        : t("sub.soon", { days: sub.daysLeft, date })
  return (
    <div
      role="status"
      className={`flex items-start gap-2 border-b px-4 py-2 text-sm md:px-6 ${bad ? "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100" : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"}`}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <span>{text}</span>
    </div>
  )
}
