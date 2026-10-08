"use client"

import Link from "next/link"
import { FileQuestion, Home, RotateCw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/provider"

/** The page shown for "not found" and for unexpected errors. Never shows the error text, only a short reference to quote when asking for help. */
export function ErrorView({ kind, digest, reset }: { kind: "notFound" | "error"; digest?: string; reset?: () => void }) {
  const t = useT()
  const Icon = kind === "notFound" ? FileQuestion : TriangleAlert
  return (
    <main className="mx-auto flex min-h-[60svh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <span className={kind === "notFound" ? "grid size-14 place-items-center rounded-full bg-primary/10 text-primary" : "grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive"}>
        <Icon className="size-7" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">{t(kind === "notFound" ? "err.notFoundTitle" : "err.title")}</h1>
        <p className="text-sm text-muted-foreground">{t(kind === "notFound" ? "err.notFoundDesc" : "err.desc")}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {kind === "error" && reset && (
          <Button onClick={reset}>
            <RotateCw /> {t("err.retry")}
          </Button>
        )}
        <Button variant={kind === "error" ? "outline" : "default"} render={<Link href="/" />}>
          <Home /> {t("err.home")}
        </Button>
      </div>
      {kind === "error" && digest && <p className="font-mono text-xs text-muted-foreground">{t("err.ref", { ref: digest })}</p>}
    </main>
  )
}
