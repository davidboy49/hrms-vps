"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cancelTwoFactor, verifyTwoFactor, type TwoFaState } from "./actions"
import { useT } from "@/i18n/provider"

export function TwoFactorForm({ setup, name }: { setup: { qr: string; secret: string } | null; name: string }) {
  const t = useT()
  const router = useRouter()
  const [state, action, pending] = useActionState(verifyTwoFactor, {} as TwoFaState)

  // setup just finished: the recovery codes are shown once
  if (state.codes) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("tfa.codesTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("tfa.codesDesc")}</p>
        </div>
        <ul className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-4 font-mono text-sm">
          {state.codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <Button size="lg" className="w-full" onClick={() => router.push(state.to ?? "/")}>
          {t("tfa.codesDone")}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{setup ? t("tfa.setupTitle") : t("tfa.title")}</h1>
        <p className="text-sm text-muted-foreground">{setup ? t("tfa.setupDesc", { name }) : t("tfa.desc", { name })}</p>
      </div>
      {setup && (
        <div className="space-y-3 rounded-lg border p-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="" width={220} height={220} className="mx-auto rounded-md bg-white" />
          <p className="text-xs text-muted-foreground">{t("tfa.manual")}</p>
          <code className="block break-all rounded bg-muted px-2 py-1 text-xs tracking-wider">{setup.secret}</code>
        </div>
      )}
      <form action={action} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="code">{setup ? t("tfa.firstCode") : t("tfa.code")}</Label>
          <Input id="code" name="code" inputMode="text" autoComplete="one-time-code" autoCapitalize="characters" autoCorrect="off" spellCheck={false} required autoFocus className="text-center font-mono text-lg tracking-widest" />
          {!setup && <p className="text-xs text-muted-foreground">{t("tfa.recoveryHint")}</p>}
        </div>
        {state.error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {t("tfa.verify")}
        </Button>
      </form>
      <form action={cancelTwoFactor}>
        <Button type="submit" variant="ghost" size="sm" className="w-full">
          {t("tfa.back")}
        </Button>
      </form>
    </div>
  )
}
