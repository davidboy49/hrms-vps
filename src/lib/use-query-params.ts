"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

export function useQueryParams() {
  const router = useRouter()
  const path = usePathname()
  const sp = useSearchParams()
  const set = useCallback(
    (patch: Record<string, string | null>, resetPage = true) => {
      const next = new URLSearchParams(sp.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k)
        else next.set(k, v)
      }
      if (resetPage) next.delete("page")
      const qs = next.toString()
      router.push(qs ? `${path}?${qs}` : path)
    },
    [router, path, sp],
  )
  return { sp, set, path }
}
