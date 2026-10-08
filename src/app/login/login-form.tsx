"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { login } from "./actions"
import { useT } from "@/i18n/provider"

export function LoginForm({ next = "" }: { next?: string }) {
  const t = useT()
  const [state, action, pending] = useActionState(login, {})
  const [show, setShow] = useState(false)
  // React clears uncontrolled fields after a form action, so keep the username in state and refocus the password after a failed attempt
  const [username, setUsername] = useState("")
  const passwordRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (state.error) passwordRef.current?.focus()
  }, [state])
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1.5">
        <Label htmlFor="username">{t("login.username")}</Label>
        <Input id="username" name="username" type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t("login.password")}</Label>
        <div className="relative">
          <Input ref={passwordRef} id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="pr-9" />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? t("login.hide") : t("login.show")}
            className="absolute inset-y-0 right-0 grid w-9 place-items-center text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="remember" className="size-4 accent-[var(--primary)]" defaultChecked /> {t("login.keep")}
      </label>
      {state.error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t(state.error)}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {t("login.submit")}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{t("login.forgot")}</p>
    </form>
  )
}
