"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/native-select"
import { useQueryParams } from "@/lib/use-query-params"
import { useT } from "@/i18n/provider"

export function Pager({ total, page, size }: { total: number; page: number; size: number }) {
  const t = useT()
  const { set } = useQueryParams()
  const pages = Math.max(1, Math.ceil(total / size))
  const from = total === 0 ? 0 : (page - 1) * size + 1
  const to = Math.min(total, page * size)

  const nums: (number | "…")[] = []
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i)
    else if (nums[nums.length - 1] !== "…") nums.push("…")
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2.5 text-sm text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>
          {t("pager.showing", { from, to, total })}
        </span>
        <label className="flex items-center gap-1.5">
          <span className="sr-only sm:not-sr-only">{t("pager.perPage")}</span>
          <NativeSelect value={size} onChange={(e) => set({ size: e.target.value })} className="h-7 w-[4.5rem]" aria-label={t("pager.rowsPerPage")}>
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>
      <nav className="flex items-center gap-1" aria-label={t("pager.pagination")}>
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) }, false)} aria-label={t("pager.prev")}>
          <ChevronLeft />
        </Button>
        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="px-1">
              …
            </span>
          ) : (
            <Button key={n} variant={n === page ? "default" : "outline"} size="icon-sm" onClick={() => set({ page: String(n) }, false)} aria-current={n === page ? "page" : undefined}>
              {n}
            </Button>
          ),
        )}
        <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => set({ page: String(page + 1) }, false)} aria-label={t("pager.next")}>
          <ChevronRight />
        </Button>
      </nav>
    </div>
  )
}
