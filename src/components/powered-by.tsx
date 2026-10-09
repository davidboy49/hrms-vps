"use client"

import { useT } from "@/i18n/provider"

/** "Powered by HR Toch" with the product mark. The customer's own brand leads; this keeps the product quietly visible. */
export function PoweredBy({ compact, tagline }: { compact?: boolean; tagline?: boolean }) {
  const t = useT()
  return (
    <p className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground" title={t("app.poweredBy", { name: "HR Toch" })}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/hr-toch-mark.png" alt="" className="size-5 shrink-0 rounded bg-white object-contain ring-1 ring-border" />
      {!compact && (
        <span className="min-w-0 truncate">
          {t("app.poweredBy", { name: "HR Toch" })}
          {tagline && <span> · {t("app.tagline")}</span>}
        </span>
      )}
    </p>
  )
}
