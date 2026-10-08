"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { assertPerm, getSession, can } from "@/lib/session"
import { audit } from "@/lib/audit"
import { toDate } from "@/lib/format"
import { getT } from "@/i18n/server"

type R = { ok?: boolean; error?: string }
const refresh = () => revalidatePath("/overtime")

async function me() {
  const u = await getSession()
  if (!u) throw new Error("Not allowed")
  const row = await db.user.findUnique({ where: { id: u.id }, select: { employeeId: true } })
  return { ...u, employeeId: row?.employeeId ?? null }
}

const requestShape = z.object({
  employeeId: z.string().optional(),
  overtimeTypeId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number().min(0.25).max(16),
  reason: z.string().trim().max(300).optional(),
})

export async function requestOvertime(input: z.input<typeof requestShape>): Promise<R> {
  const t = await getT()
  const u = await me()
  const p = requestShape.safeParse(input)
  if (!p.success) return { error: t("ot.err.invalid") }
  const employeeId = can(u, "overtime.manage") && p.data.employeeId ? p.data.employeeId : u.employeeId
  if (!employeeId) return { error: t("lv.err.noEmployee") }
  const type = await db.overtimeType.findUnique({ where: { id: p.data.overtimeTypeId } })
  if (!type || !type.isActive) return { error: t("ot.err.invalid") }
  const hours = Math.round(p.data.hours * 4) / 4
  const row = await db.overtimeRequest.create({
    data: { employeeId, overtimeTypeId: type.id, date: toDate(p.data.date)!, hours, reason: p.data.reason || null, requestedBy: u.id },
  })
  await audit(u.id, "request", "OvertimeRequest", row.id, `${type.code} ${p.data.date} ${hours}h`)
  refresh()
  return { ok: true }
}

export async function decideOvertime(id: string, decision: "APPROVED" | "REJECTED", note?: string): Promise<R> {
  const t = await getT()
  const u = await assertPerm("overtime.manage")
  const r = await db.overtimeRequest.findUnique({ where: { id } })
  if (!r || r.status !== "PENDING") return { error: t("lv.err.decided") }
  await db.overtimeRequest.update({ where: { id }, data: { status: decision, decidedBy: u.id, decidedAt: new Date(), decisionNote: note?.trim() || null } })
  await audit(u.id, decision.toLowerCase(), "OvertimeRequest", id)
  refresh()
  return { ok: true }
}

export async function cancelOvertime(id: string): Promise<R> {
  const t = await getT()
  const u = await me()
  const r = await db.overtimeRequest.findUnique({ where: { id } })
  if (!r || (r.status !== "PENDING" && r.status !== "APPROVED")) return { error: t("lv.err.decided") }
  if (!can(u, "overtime.manage") && (r.employeeId !== u.employeeId || r.status !== "PENDING")) return { error: t("lv.err.decided") }
  await db.overtimeRequest.update({ where: { id }, data: { status: "CANCELLED", decidedBy: u.id, decidedAt: new Date() } })
  await audit(u.id, "cancel", "OvertimeRequest", id)
  refresh()
  return { ok: true }
}

const typeShape = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{1,20}$/, "lv.err.code"),
  name: z.string().trim().min(1, "sch.err.name").max(60),
  multiplier: z.number().min(1).max(10),
  isActive: z.boolean(),
})

export async function saveOvertimeType(id: string | null, input: z.input<typeof typeShape>): Promise<R> {
  const t = await getT()
  const u = await assertPerm("overtime.manage")
  const p = typeShape.safeParse(input)
  if (!p.success) return { error: t(p.error.issues[0].message) }
  try {
    const row = id ? await db.overtimeType.update({ where: { id }, data: p.data }) : await db.overtimeType.create({ data: p.data })
    await audit(u.id, id ? "update" : "create", "OvertimeType", row.id, row.code)
  } catch {
    return { error: t("lv.err.codeUsed") }
  }
  refresh()
  return { ok: true }
}
