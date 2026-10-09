"use client"

import Link from "next/link"
import { useActionState, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Camera, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/native-select"
import { PersonAvatar } from "@/components/avatar"
import { saveEmployee, type FormState } from "./actions"
import { useT } from "@/i18n/provider"
import { labelFor } from "@/i18n/core"

type Opt = { id: string; code?: string; name: string; requiresEndDate?: boolean; defaultRateBasis?: string; departmentId?: string | null }

export type FormValues = {
  employeeNo: string
  nameEn: string
  nameKm: string
  gender: string
  dob: string
  phone: string
  email: string
  nationalId: string
  address: string
  departmentId: string
  designationId: string
  contractTypeId: string
  statusId: string
  locationId: string
  shiftId: string
  scheduleTemplateId: string
  joiningDate: string
  contractEnd: string
  leavingDate: string
  rateAmount: string
  rateBasis: string
  currency: string
  zkPin: string
  photoUrl: string | null
}

export function EmployeeForm({
  id,
  values,
  lookups,
  personalTemplate = false,
}: {
  id: string | null
  values: FormValues
  lookups: { departments: Opt[]; designations: Opt[]; contractTypes: Opt[]; statuses: Opt[]; locations: Opt[]; shifts: Opt[]; scheduleTemplates: Opt[] }
  /** the person has their own weekly pattern set on the roster */
  personalTemplate?: boolean
}) {
  const t = useT()
  const [state, action, pending] = useActionState(saveEmployee.bind(null, id), {} as FormState)
  const [v, setV] = useState(values)
  const [preview, setPreview] = useState<string | null>(values.photoUrl)
  const [removed, setRemoved] = useState(false)
  const [fileErr, setFileErr] = useState<string | null>(null)
  const photoFile = useRef<File | null>(null)
  const f = state.fields ?? {}

  // After each save attempt: React clears the file input, so put the chosen photo back,
  // then tell the user what went wrong and bring the first problem into view.
  useEffect(() => {
    if (!state.error) return
    const input = document.getElementById("photo") as HTMLInputElement | null
    if (input && photoFile.current && !input.files?.length) {
      const dt = new DataTransfer()
      dt.items.add(photoFile.current)
      input.files = dt.files
    }
    toast.error(t(state.error))
    requestAnimationFrame(() => {
      const first = Object.keys(state.fields ?? {})[0]
      const el = (first && document.getElementById(first)) || document.querySelector<HTMLElement>('[role="alert"]')
      el?.scrollIntoView({ behavior: "smooth", block: "center" })
      if (el && "focus" in el) el.focus({ preventScroll: true })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])
  const set = (k: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }))

  const ct = lookups.contractTypes.find((c) => c.id === v.contractTypeId)
  const desigs = useMemo(
    () => (v.departmentId ? lookups.designations.filter((d) => !d.departmentId || d.departmentId === v.departmentId) : lookups.designations),
    [lookups.designations, v.departmentId],
  )

  const field = (k: string, label: string, input: React.ReactNode, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      {input}
      {f[k] ? (
        <p className="text-xs text-destructive" role="alert">
          {f[k]}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )

  const text = (k: keyof FormValues, props: React.ComponentProps<typeof Input> = {}) => (
    <Input id={k} name={k} value={(v[k] as string) ?? ""} onChange={set(k)} aria-invalid={!!f[k]} {...props} />
  )
  const select = (k: keyof FormValues, opts: Opt[], blank?: string, prefix?: string) => (
    <NativeSelect id={k} name={k} value={(v[k] as string) ?? ""} onChange={set(k)} aria-invalid={!!f[k]}>
      {(blank !== undefined || !v[k]) && <option value="">{blank ?? t("common.select")}</option>}
      {opts.map((o) => (
        <option key={o.id} value={o.id}>
          {prefix && o.code ? labelFor(t, prefix, o.code, o.name) : o.name}
        </option>
      ))}
    </NativeSelect>
  )

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="removePhoto" value={removed ? "1" : "0"} />

      <section className="flex flex-wrap items-center gap-5 rounded-lg border p-4">
        <PersonAvatar name={v.nameEn || "?"} url={removed ? null : preview} className="size-24 text-2xl" />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" render={<label htmlFor="photo" className="cursor-pointer" />}>
              <Camera /> {preview && !removed ? t("form.photoReplace") : t("form.photoUpload")}
            </Button>
            {preview && !removed && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRemoved(true)
                  photoFile.current = null
                  const el = document.getElementById("photo") as HTMLInputElement
                  if (el) el.value = ""
                }}
              >
                <Trash2 /> {t("common.remove")}
              </Button>
            )}
          </div>
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              if (file.size > 2 * 1024 * 1024) {
                setFileErr(t("form.photoSize"))
                toast.error(t("form.photoSize"))
                photoFile.current = null
                e.target.value = ""
                return
              }
              setFileErr(null)
              setRemoved(false)
              photoFile.current = file
              setPreview(URL.createObjectURL(file))
            }}
          />
          <p className="text-xs text-muted-foreground">{t("form.photoHint")}</p>
          {fileErr && <p className="text-xs text-destructive">{fileErr}</p>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("form.personal")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field("nameEn", t("form.nameEn"), text("nameEn", { required: true }))}
          {field("nameKm", t("form.nameKm"), text("nameKm", { lang: "km" }))}
          {field(
            "gender",
            t("form.gender"),
            <NativeSelect id="gender" name="gender" value={v.gender} onChange={set("gender")}>
              <option value="">—</option>
              <option value="MALE">{t("gender.MALE")}</option>
              <option value="FEMALE">{t("gender.FEMALE")}</option>
              <option value="OTHER">{t("gender.OTHER")}</option>
            </NativeSelect>,
          )}
          {field("dob", t("form.dob"), text("dob", { type: "date" }))}
          {field("phone", t("form.phone"), text("phone", { type: "tel" }))}
          {field("email", t("form.email"), text("email", { type: "email" }))}
          {field("nationalId", t("form.nationalId"), text("nationalId"))}
          <div className="sm:col-span-2">{field("address", t("form.address"), text("address"))}</div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("form.job")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field("employeeNo", t("form.employeeNo"), text("employeeNo", { required: true, className: "font-mono" }))}
          {field("departmentId", t("emp.department"), select("departmentId", lookups.departments))}
          {field("designationId", t("emp.designation"), select("designationId", desigs))}
          {field("statusId", t("emp.status"), select("statusId", lookups.statuses, undefined, "status"), t("emp.statusHint"))}
          {field("joiningDate", t("emp.joining"), text("joiningDate", { type: "date", required: true }))}
          {field("locationId", t("form.location"), select("locationId", lookups.locations, "—"))}
          {field("shiftId", t("form.shift"), select("shiftId", lookups.shifts, "—"))}
          {field(
            "scheduleTemplateId",
            t("form.scheduleTemplate"),
            <NativeSelect id="scheduleTemplateId" name="scheduleTemplateId" value={v.scheduleTemplateId} onChange={set("scheduleTemplateId")}>
              {personalTemplate && <option value="__personal">{t("form.schedulePersonal")}</option>}
              <option value="">{t("form.scheduleDefault")}</option>
              {lookups.scheduleTemplates.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </NativeSelect>,
            t("form.scheduleHint"),
          )}
          {field("leavingDate", t("form.leavingDate"), text("leavingDate", { type: "date" }), t("form.leavingHint"))}
          {field("zkPin", t("form.zkPin"), text("zkPin", { className: "font-mono" }), t("form.zkPinHint"))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("form.contractRate")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field(
            "contractTypeId",
            t("form.contractType"),
            <NativeSelect
              id="contractTypeId"
              name="contractTypeId"
              value={v.contractTypeId}
              aria-invalid={!!f.contractTypeId}
              onChange={(e) => {
                const c = lookups.contractTypes.find((x) => x.id === e.target.value)
                setV((s) => ({ ...s, contractTypeId: e.target.value, rateBasis: !id && c?.defaultRateBasis ? c.defaultRateBasis : s.rateBasis }))
              }}
            >
              <option value="">{t("common.select")}</option>
              {lookups.contractTypes.map((o) => (
                <option key={o.id} value={o.id}>
                  {labelFor(t, "contract", o.code ?? "", o.name)}
                </option>
              ))}
            </NativeSelect>,
          )}
          {field("contractEnd", ct?.requiresEndDate ? t("form.contractEndReq") : t("form.contractEnd"), text("contractEnd", { type: "date" }))}
          <div />
          {field("rateAmount", t("emp.rate"), text("rateAmount", { type: "number", step: "0.01", min: "0", required: true }))}
          {field(
            "rateBasis",
            t("form.rateBasis"),
            <NativeSelect id="rateBasis" name="rateBasis" value={v.rateBasis} onChange={set("rateBasis")}>
              <option value="MONTH">{t("basis.MONTH")}</option>
              <option value="DAY">{t("basis.DAY")}</option>
              <option value="HOUR">{t("basis.HOUR")}</option>
            </NativeSelect>,
          )}
          {field(
            "currency",
            t("form.currency"),
            <NativeSelect id="currency" name="currency" value={v.currency} onChange={set("currency")}>
              <option value="USD">USD</option>
              <option value="KHR">KHR</option>
            </NativeSelect>,
            id ? t("form.rateHint") : undefined,
          )}
        </div>
      </section>

      {state.error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error ? t(state.error) : null}
        </p>
      )}
      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <Button variant="outline" render={<Link href={id ? `/employees/${id}` : "/employees"} />}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {id ? t("form.saveChanges") : t("form.create")}
        </Button>
      </div>
    </form>
  )
}
