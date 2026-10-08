"use client"

import { useActionState, useState } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { completePasswordChange } from "./actions"
import { useT } from "@/i18n/provider"

export function ChangePasswordForm() {
  const t = useT()
  const [state, action, pending] = useActionState(completePasswordChange, {})
  const [show, setShow] = useState(false)
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="next">{t("cp.new")}</Label>
        <div className="relative">
          <Input id="next" name="next" type={show ? "text" : "password"} autoComplete="new-password" required autoFocus className="pr-9" />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? t("login.hide") : t("login.show")}
            className="absolute inset-y-0 right-0 grid w-9 place-items-center text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{t("cp.hint")}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="again">{t("cp.again")}</Label>
        <Input id="again" name="again" type={show ? "text" : "password"} autoComplete="new-password" required />
      </div>
      {state.error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t(state.error)}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />} {t("cp.save")}
      </Button>
    </form>
  )
}
