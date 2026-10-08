"use client"

import { useState } from "react"
import { LogOut } from "lucide-react"
import { logout } from "@/app/login/actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useT } from "@/i18n/provider"

/** Asks "are you sure?" before signing out, so a stray tap does not end the session. */
export function SignOutButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      {iconOnly ? (
        <Button variant="ghost" size="icon" type="button" aria-label={t("nav.signOut")} onClick={() => setOpen(true)}>
          <LogOut />
        </Button>
      ) : (
        <Button variant="ghost" size="sm" type="button" onClick={() => setOpen(true)}>
          {t("nav.signOut")}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("nav.signOutConfirm")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("nav.signOutConfirmDesc")}</p>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <form action={logout}>
              <Button type="submit">{t("nav.signOut")}</Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
