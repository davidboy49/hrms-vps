"use client"

import { useState, useTransition } from "react"
import { Loader2, Pencil, Plug, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { NativeSelect } from "@/components/native-select"
import { deleteDevice, saveDevice, syncAll, syncOne, testDevice } from "./actions"
import { useT } from "@/i18n/provider"

export type DeviceView = {
  id: string
  name: string
  model: string | null
  ip: string | null
  port: number
  serialNo: string | null
  mode: "MOCK" | "PULL" | "PUSH" | "QR"
  status: "ONLINE" | "OFFLINE"
  locationId: string | null
  lastSync: string
  todayPunches: number
  users: number
}

const MODE_KEY = { MOCK: "mode.MOCK", PULL: "mode.PULL", PUSH: "mode.PUSH", QR: "mode.QR" } as const

export function SyncAllButton() {
  const t = useT()
  const [pending, start] = useTransition()
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await syncAll()
          if (r.failed) toast.warning(t("att.syncWarn", { n: r.inserted, f: r.failed }))
          else toast.success(t("att.syncOk", { n: r.inserted, d: r.devices }))
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} {t("att.syncAll")}
    </Button>
  )
}

export function DeviceCards({ devices, locations, canEdit, isAdmin }: { devices: DeviceView[]; locations: { id: string; name: string }[]; canEdit: boolean; isAdmin: boolean }) {
  const t = useT()
  const [edit, setEdit] = useState<DeviceView | "new" | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()

  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  const cur = edit && edit !== "new" ? edit : null

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {devices.map((d) => (
          <div key={d.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{d.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {d.model ?? "ZKTeco"} {d.ip ? `· ${d.ip}:${d.port}` : ""}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${d.status === "ONLINE" ? "bg-green-500/15 text-green-700 dark:text-green-300" : "bg-red-500/15 text-red-700 dark:text-red-300"}`}>
                <span className="size-1.5 rounded-full bg-current" />
                {d.status === "ONLINE" ? t("att.online") : t("att.offline")}
              </span>
            </div>
            <div className="flex gap-6 text-xs text-muted-foreground">
              <div>
                <b className="block text-base text-foreground tabular-nums">{d.users}</b>{t("att.users")}
              </div>
              <div>
                <b className="block text-base text-foreground tabular-nums">{d.todayPunches}</b>{t("att.punchesToday")}
              </div>
              <div>
                <b className="block text-base text-foreground">{d.lastSync}</b>{t("att.lastSync")}
              </div>
              <div>
                <b className="block text-base text-foreground">{t(MODE_KEY[d.mode])}</b>{t("att.mode")}
              </div>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === d.id || d.mode === "PUSH" || d.mode === "QR"}
                  onClick={() =>
                    run(d.id, async () => {
                      const r = await syncOne(d.id)
                      if (r.ok) toast.success(t("att.newPunches", { n: r.inserted }))
                      else toast.error(r.message)
                    })
                  }
                >
                  {busy === d.id ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sync now
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === d.id}
                  onClick={() =>
                    run(d.id, async () => {
                      const r = await testDevice(d.id)
                      if (r.ok) toast.success(r.message)
                      else toast.error(r.message)
                    })
                  }
                >
                  <Plug /> {t("att.test")}
                </Button>
                {isAdmin && (
                  <>
                    <Button size="icon-sm" variant="ghost" aria-label={t("att.editDev", { name: d.name })} onClick={() => { setErr(null); setEdit(d) }}>
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t("att.delDev", { name: d.name })}
                      onClick={() => {
                        if (window.confirm(t("att.delConfirm", { name: d.name }))) start(async () => { await deleteDevice(d.id); toast.success(t("att.devDeleted")) })
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </>
                )}
              </div>
            )}
            {d.mode === "PUSH" && (
              <p className="text-xs text-muted-foreground">
                {t("att.pushHint")} <span className="font-mono">/iclock/cdata?token=…</span> · {t("att.serial")}: <span className="font-mono">{d.serialNo ?? t("att.notSet")}</span>
              </p>
            )}
          </div>
        ))}
        {isAdmin && (
          <button onClick={() => { setErr(null); setEdit("new") }} className="flex min-h-32 items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm text-muted-foreground hover:bg-muted/40">
            <Plus className="size-4" /> {t("att.addDevice")}
          </button>
        )}
      </div>

      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cur ? t("att.editDevice") : t("att.addDevice")}</DialogTitle>
          </DialogHeader>
          <form
            key={cur?.id ?? "new"}
            action={(fd) =>
              start(async () => {
                const r = await saveDevice(cur?.id ?? null, fd)
                if (r.error) setErr(r.error)
                else {
                  setEdit(null)
                  toast.success(t("att.devSaved"))
                }
              })
            }
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="d-name">{t("common.name")}</Label>
              <Input id="d-name" name="name" defaultValue={cur?.name} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="d-model">{t("att.model")}</Label>
                <Input id="d-model" name="model" defaultValue={cur?.model ?? ""} placeholder="SpeedFace-V5L" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-serial">{t("att.serialNo")}</Label>
                <Input id="d-serial" name="serialNo" defaultValue={cur?.serialNo ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-ip">{t("att.ip")}</Label>
                <Input id="d-ip" name="ip" defaultValue={cur?.ip ?? ""} placeholder="192.168.1.201" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-port">{t("att.port")}</Label>
                <Input id="d-port" name="port" type="number" defaultValue={cur?.port ?? 4370} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-mode">{t("att.mode")}</Label>
                <NativeSelect id="d-mode" name="mode" defaultValue={cur?.mode ?? "MOCK"}>
                  <option value="MOCK">{t("mode.MOCK.long")}</option>
                  <option value="PULL">{t("mode.PULL.long")}</option>
                  <option value="PUSH">{t("mode.PUSH.long")}</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-loc">{t("form.location")}</Label>
                <NativeSelect id="d-loc" name="locationId" defaultValue={cur?.locationId ?? ""}>
                  <option value="">—</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEdit(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
