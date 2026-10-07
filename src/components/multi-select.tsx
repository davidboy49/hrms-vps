"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useT } from "@/i18n/provider"

export type Option = { value: string; label: string }

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: Option[]
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const t = useT()
  const [q, setQ] = useState("")
  const shown = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
  const labels = options.filter((o) => value.includes(o.value)).map((o) => o.label)
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
          !labels.length && "text-muted-foreground",
        )}
      >
        <span className="truncate">{labels.length === 0 ? (placeholder ?? t("common.any")) : labels.length <= 2 ? labels.join(", ") : t("common.nSelected", { n: labels.length })}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        {options.length > 8 && <Input placeholder={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} />}
        <div className="max-h-56 overflow-y-auto">
          {shown.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={value.includes(o.value)}
                onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))}
              />
              <span className="truncate">{o.label}</span>
            </label>
          ))}
          {!shown.length && <p className="px-2 py-1.5 text-muted-foreground">{t("common.noMatches")}</p>}
        </div>
        {value.length > 0 && (
          <button type="button" className="self-start px-2 text-xs text-primary hover:underline" onClick={() => onChange([])}>
            {t("common.clear")}
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
