"use client"

import { useTransition } from "react"
import { Languages } from "lucide-react"
import { setLocale } from "@/i18n/actions"
import { LOCALES } from "@/i18n/core"
import { useLocale, useT } from "@/i18n/provider"
import { cn } from "@/lib/utils"

/** Two-way switch. The choice is remembered in a cookie, so it also applies on the login page. */
export function LanguageSwitcher({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  const locale = useLocale()
  const t = useT()
  const [pending, start] = useTransition()
  return (
    <div
      role="group"
      aria-label={t("lang.label")}
      className={cn("inline-flex items-center gap-0.5 rounded-lg border p-0.5 text-xs", onDark ? "border-white/30 bg-white/10 text-white" : "bg-background", className)}
    >
      <Languages className="mx-1 size-3.5 opacity-60" aria-hidden />
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          disabled={pending}
          aria-pressed={locale === l.code}
          onClick={() => locale !== l.code && start(() => setLocale(l.code))}
          className={cn(
            "rounded-md px-2 py-1 font-medium transition-colors",
            locale === l.code ? (onDark ? "bg-white text-primary" : "bg-primary text-primary-foreground") : onDark ? "hover:bg-white/15" : "text-muted-foreground hover:bg-muted",
          )}
        >
          {l.short}
        </button>
      ))}
    </div>
  )
}
