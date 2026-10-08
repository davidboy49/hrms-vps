"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { assertPerm } from "@/lib/session"
import { audit } from "@/lib/audit"
import { entityByKey, type FieldDef } from "@/lib/masterdata"
import { getT } from "@/i18n/server"

// Prisma delegates share the same method names, so a loose type is fine for this generic CRUD.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const delegate = (model: string) => (db as any)[model]

function coerce(f: FieldDef, raw: FormDataEntryValue | null) {
  const s = raw == null ? "" : String(raw).trim()
  switch (f.type) {
    case "bool":
      return raw === "on" || s === "true"
    case "number":
      return s === "" ? 0 : Number(s)
    case "decimal":
      return s === "" || Number.isNaN(Number(s)) ? null : Number(s)
    case "date":
      return s ? new Date(s + "T00:00:00.000Z") : null
    case "relation":
      return s || null
    default:
      return s
  }
}

export async function saveRow(entityKey: string, id: string | null, form: FormData): Promise<{ error?: string }> {
  const t = await getT()
  const user = await assertPerm("masterdata.edit")
  const ent = entityByKey(entityKey)
  if (!ent) return { error: t("md.err.unknown") }
  const data: Record<string, unknown> = {}
  for (const f of ent.fields) {
    const v = coerce(f, form.get(f.name))
    if (f.required && (v === "" || v === null || (typeof v === "number" && Number.isNaN(v)))) return { error: t("md.err.required", { field: t(f.label) }) }
    if (f.type === "time" && !/^\d{2}:\d{2}$/.test(String(v))) return { error: t("md.err.time", { field: t(f.label) }) }
    data[f.name] = v
  }
  if (typeof data.code === "string") data.code = data.code.toUpperCase().replace(/\s+/g, "")
  if (id && data.parentId === id) return { error: t("md.err.parent") }
  try {
    if (id) await delegate(ent.model).update({ where: { id }, data })
    else await delegate(ent.model).create({ data })
  } catch (e) {
    const msg = (e as { code?: string }).code === "P2002" ? t("md.err.dupCode") : t("md.err.save")
    return { error: msg }
  }
  await audit(user.id, id ? "update" : "create", ent.model, id ?? undefined, String(data.name))
  revalidatePath(`/masterdata/${entityKey}`)
  return {}
}

export async function setActive(entityKey: string, id: string, active: boolean) {
  const user = await assertPerm("masterdata.edit")
  const ent = entityByKey(entityKey)
  if (!ent) return
  await delegate(ent.model).update({ where: { id }, data: { isActive: active } })
  await audit(user.id, active ? "activate" : "deactivate", ent.model, id)
  revalidatePath(`/masterdata/${entityKey}`)
}

export async function deleteRow(entityKey: string, id: string): Promise<{ error?: string }> {
  const t = await getT()
  const user = await assertPerm("masterdata.delete")
  const ent = entityByKey(entityKey)
  if (!ent) return { error: t("md.err.unknown") }
  try {
    await delegate(ent.model).delete({ where: { id } })
  } catch {
    return { error: t("md.err.inUse") }
  }
  await audit(user.id, "delete", ent.model, id)
  revalidatePath(`/masterdata/${entityKey}`)
  return {}
}
