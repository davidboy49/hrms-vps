"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { assertRole } from "@/lib/session"
import { audit } from "@/lib/audit"
import { relinkUnknown, syncDevice } from "@/lib/attendance"
import { adapterFor } from "@/lib/devices"
import { getT } from "@/i18n/server"

export async function syncOne(id: string) {
  const t = await getT()
  await assertRole("HR")
  const r = await syncDevice(id)
  revalidatePath("/attendance")
  return r.ok ? r : { ...r, message: t(r.message) }
}

export async function syncAll() {
  const user = await assertRole("HR")
  const devices = await db.device.findMany({ where: { isActive: true, mode: { notIn: ["PUSH", "QR"] } } })
  let inserted = 0
  let failed = 0
  for (const d of devices) {
    const r = await syncDevice(d.id)
    if (r.ok) inserted += r.inserted
    else failed++
  }
  await relinkUnknown()
  await audit(user.id, "sync", "Device", undefined, `${devices.length} devices, ${inserted} new punches`)
  revalidatePath("/attendance")
  return { devices: devices.length, inserted, failed }
}

export async function testDevice(id: string) {
  const t = await getT()
  await assertRole("HR")
  const d = await db.device.findUnique({ where: { id } })
  if (!d) return { ok: false, message: t("dev.notFound") }
  const r = await adapterFor(d).testConnection()
  await db.device.update({ where: { id }, data: { status: r.ok ? "ONLINE" : "OFFLINE" } })
  revalidatePath("/attendance")
  return { ...r, message: t(r.message) }
}

const deviceSchema = z.object({
  name: z.string().trim().min(1, "err.nameReq"),
  model: z.string().trim().optional(),
  ip: z.string().trim().optional(),
  port: z.coerce.number().int().min(1).max(65535).default(4370),
  serialNo: z.string().trim().optional(),
  mode: z.enum(["MOCK", "PULL", "PUSH"]),
  locationId: z.string().optional(),
})

export async function saveDevice(id: string | null, form: FormData): Promise<{ error?: string }> {
  const t = await getT()
  const user = await assertRole("ADMIN")
  const p = deviceSchema.safeParse(Object.fromEntries(form.entries()))
  if (!p.success) return { error: t(p.error.issues[0].message) }
  const d = p.data
  const data = { name: d.name, model: d.model || null, ip: d.ip || null, port: d.port, serialNo: d.serialNo || null, mode: d.mode, locationId: d.locationId || null }
  if (id) await db.device.update({ where: { id }, data })
  else await db.device.create({ data })
  await audit(user.id, id ? "update" : "create", "Device", id ?? undefined, d.name)
  revalidatePath("/attendance")
  return {}
}

export async function deleteDevice(id: string) {
  const user = await assertRole("ADMIN")
  await db.device.delete({ where: { id } })
  await audit(user.id, "delete", "Device", id)
  revalidatePath("/attendance")
}
