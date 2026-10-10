"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { assertPerm } from "@/lib/session"
import { payrollEdition } from "@/lib/edition"
import { audit } from "@/lib/audit"
import { toDate } from "@/lib/format"
import { POLICY_KEYS } from "@/lib/pay-policy"
import { getT } from "@/i18n/server"

type R = { ok?: boolean; error?: string }
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const refresh = (employeeId?: string) => {
  revalidatePath("/payroll/setup")
  if (employeeId) revalidatePath(`/employees/${employeeId}`)
}

/** Every payroll action: Payroll edition only, and needs the payroll.manage permission. */
async function guard() {
  if (!payrollEdition()) throw new Error("Not allowed")
  return assertPerm("payroll.manage")
}

const policyShape = z.object({
  dayDivisorMode: z.enum(["fixed", "actual"]),
  dayDivisorFixed: z.number().min(20).max(31),
  hoursPerDay: z.number().min(1).max(24),
  lateDeduction: z.enum(["off", "perMinute"]),
})

export async function savePolicy(input: z.input<typeof policyShape>): Promise<R> {
  const t = await getT()
  const u = await guard()
  const p = policyShape.safeParse(input)
  if (!p.success) return { error: t("pay.err.policy") }
  const entries: [string, string][] = [
    [POLICY_KEYS.dayDivisorMode, p.data.dayDivisorMode],
    [POLICY_KEYS.dayDivisorFixed, String(p.data.dayDivisorFixed)],
    [POLICY_KEYS.hoursPerDay, String(p.data.hoursPerDay)],
    [POLICY_KEYS.lateDeduction, p.data.lateDeduction],
  ]
  for (const [key, value] of entries) await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
  await audit(u.id, "update", "PayPolicy", undefined, entries.map(([k, v]) => `${k}=${v}`).join(" "))
  refresh()
  return { ok: true }
}

const componentShape = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,20}$/),
  name: z.string().trim().min(1).max(60),
  nameKm: z.string().trim().max(60).optional().transform((v) => v || null),
  kind: z.enum(["ALLOWANCE", "DEDUCTION"]),
  calc: z.enum(["FIXED", "PERCENT_OF_BASE"]),
  defaultAmount: z.number().min(0).max(1_000_000).nullish().transform((v) => v ?? null),
  taxable: z.boolean(),
  nssfBase: z.boolean(),
})

export async function saveComponent(id: string | null, input: z.input<typeof componentShape>): Promise<R> {
  const t = await getT()
  const u = await guard()
  const p = componentShape.safeParse(input)
  if (!p.success) return { error: t("pay.err.component") }
  const d = p.data
  if (d.calc === "PERCENT_OF_BASE" && d.defaultAmount !== null && d.defaultAmount > 100) return { error: t("pay.err.percent") }
  const dup = await db.payComponent.findUnique({ where: { code: d.code } })
  if (dup && dup.id !== id) return { error: t("pay.err.codeTaken") }
  const data = { code: d.code, name: d.name, nameKm: d.nameKm, kind: d.kind, calc: d.calc, defaultAmount: d.defaultAmount, taxable: d.kind === "ALLOWANCE" ? d.taxable : false, nssfBase: d.kind === "ALLOWANCE" ? d.nssfBase : false }
  if (id) {
    const cur = await db.payComponent.findUnique({ where: { id } })
    if (!cur) return { error: t("pay.err.component") }
    // the sign of the money must not flip under people who already have it
    if (cur.kind !== d.kind && (await db.employeeComponent.count({ where: { componentId: id } })) > 0) return { error: t("pay.err.kindLocked") }
    await db.payComponent.update({ where: { id }, data })
  } else {
    await db.payComponent.create({ data })
  }
  await audit(u.id, id ? "update" : "create", "PayComponent", id ?? undefined, `${d.code} ${d.kind}`)
  refresh()
  return { ok: true }
}

export async function setComponentActive(id: string, active: boolean): Promise<R> {
  const u = await guard()
  await db.payComponent.update({ where: { id }, data: { isActive: active } })
  await audit(u.id, active ? "enable" : "disable", "PayComponent", id)
  refresh()
  return { ok: true }
}

const SUGGESTED = [
  { code: "TRANSPORT", name: "Transport allowance", nameKm: "ប្រាក់ឧបត្ថម្ភធ្វើដំណើរ", kind: "ALLOWANCE" as const },
  { code: "MEAL", name: "Meal allowance", nameKm: "ប្រាក់ឧបត្ថម្ភអាហារ", kind: "ALLOWANCE" as const },
  { code: "POSITION", name: "Position allowance", nameKm: "ប្រាក់ឧបត្ថម្ភតួនាទី", kind: "ALLOWANCE" as const },
  { code: "ADVANCE", name: "Advance repayment", nameKm: "ការសងប្រាក់ខែមុន", kind: "DEDUCTION" as const },
]

/** A starting list; every one can be edited, disabled or ignored. Existing codes are left alone. */
export async function addSuggestedComponents(): Promise<R> {
  const u = await guard()
  let n = 0
  for (const c of SUGGESTED) {
    if (await db.payComponent.findUnique({ where: { code: c.code } })) continue
    await db.payComponent.create({ data: { ...c, calc: "FIXED", taxable: c.kind === "ALLOWANCE", nssfBase: false } })
    n++
  }
  await audit(u.id, "create", "PayComponent", undefined, `suggested types: ${n}`)
  refresh()
  return { ok: true }
}

const assignShape = z.object({
  employeeId: z.string().min(1),
  componentId: z.string().min(1),
  amount: z.number().min(0).max(1_000_000).nullish().transform((v) => v ?? null),
  validFrom: dateKey,
  validTo: dateKey.nullish().transform((v) => v || null),
  note: z.string().trim().max(200).optional().transform((v) => v || null),
})

export async function assignComponent(input: z.input<typeof assignShape>): Promise<R> {
  const t = await getT()
  const u = await guard()
  const p = assignShape.safeParse(input)
  if (!p.success) return { error: t("pay.err.assign") }
  const d = p.data
  if (d.validTo && d.validTo < d.validFrom) return { error: t("pay.err.range") }
  const [emp, comp] = await Promise.all([db.employee.findFirst({ where: { id: d.employeeId, deletedAt: null }, select: { id: true } }), db.payComponent.findUnique({ where: { id: d.componentId } })])
  if (!emp || !comp || !comp.isActive) return { error: t("pay.err.assign") }
  if (d.amount === null && comp.defaultAmount === null) return { error: t("pay.err.needAmount") }
  if (comp.calc === "PERCENT_OF_BASE" && (d.amount ?? 0) > 100) return { error: t("pay.err.percent") }
  // the same type twice for the same period would be paid twice
  const from = toDate(d.validFrom)!
  const to = d.validTo ? toDate(d.validTo)! : null
  const clash = await db.employeeComponent.findFirst({
    where: { employeeId: d.employeeId, componentId: d.componentId, AND: [{ OR: [{ validTo: null }, { validTo: { gte: from } }] }, ...(to ? [{ validFrom: { lte: to } }] : [])] },
  })
  if (clash) return { error: t("pay.err.overlap") }
  const row = await db.employeeComponent.create({ data: { employeeId: d.employeeId, componentId: d.componentId, amount: d.amount, validFrom: from, validTo: to, note: d.note, createdBy: u.id } })
  await audit(u.id, "assign", "EmployeeComponent", row.id, `${comp.code} ${d.amount ?? "default"} from ${d.validFrom}`)
  refresh(d.employeeId)
  return { ok: true }
}

export async function endAssignment(id: string, endDate: string): Promise<R> {
  const t = await getT()
  const u = await guard()
  if (!dateKey.safeParse(endDate).success) return { error: t("pay.err.assign") }
  const cur = await db.employeeComponent.findUnique({ where: { id }, include: { component: { select: { code: true } } } })
  if (!cur) return { error: t("pay.err.assign") }
  if (endDate < cur.validFrom.toISOString().slice(0, 10)) return { error: t("pay.err.range") }
  await db.employeeComponent.update({ where: { id }, data: { validTo: toDate(endDate)! } })
  await audit(u.id, "end", "EmployeeComponent", id, `${cur.component.code} until ${endDate}`)
  refresh(cur.employeeId)
  return { ok: true }
}

/** For a mistake. Once pay runs exist (phase 2B) an assignment that was paid will have to be ended instead. */
export async function removeAssignment(id: string): Promise<R> {
  const u = await guard()
  const cur = await db.employeeComponent.findUnique({ where: { id }, include: { component: { select: { code: true } } } })
  if (!cur) return { ok: true }
  await db.employeeComponent.delete({ where: { id } })
  await audit(u.id, "remove", "EmployeeComponent", id, cur.component.code)
  refresh(cur.employeeId)
  return { ok: true }
}
