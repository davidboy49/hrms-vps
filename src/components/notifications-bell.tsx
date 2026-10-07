"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getAlerts, type Alert } from "@/app/(app)/alerts-action"
import { useT } from "@/i18n/provider"

export function NotificationsBell() {
  const t = useT()
  const [alerts, setAlerts] = useState<Alert[]>([])
  useEffect(() => {
    let live = true
    getAlerts()
      .then((a) => live && setAlerts(a))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])
  const total = alerts.reduce((n, a) => n + a.count, 0)
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative" aria-label={t("alert.title")} />}>
        <Bell />
        {alerts.length > 0 && <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">{total > 99 ? "99+" : total}</span>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="px-1 text-sm font-semibold">{t("alert.title")}</p>
        {alerts.length === 0 ? (
          <p className="px-1 py-3 text-sm text-muted-foreground">{t("alert.none")}</p>
        ) : (
          <ul className="space-y-0.5">
            {alerts.map((a) => (
              <li key={a.key}>
                <Link href={a.href} className="flex items-start gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted">
                  <span className="grid min-w-6 place-items-center rounded-full bg-primary/15 px-1.5 text-xs font-semibold text-primary">{a.count}</span>
                  <span>{t(a.key, { n: a.count })}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
