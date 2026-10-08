"use server"

import ExcelJS from "exceljs"
import { revalidatePath } from "next/cache"
import { assertPerm } from "@/lib/session"
import { audit } from "@/lib/audit"
import { rateLimit, waitText } from "@/lib/rate-limit"
import { createFromPlan, MAX_BATCH, planBatch, TEMP_PASSWORD_DAYS, type Created, type Plan, type Skipped } from "@/lib/bulk-logins"
import { getT } from "@/i18n/server"

export type PreviewResult = { ok: true; role: string; count: number; sample: string[]; skipped: Skipped[] } | { error: string }
export type CreateResult = { ok: true; created: Created[]; skipped: Skipped[]; xlsx: string; days: number } | { error: string }

const ERR = { role: "bl.err.role", empty: "bl.err.empty", tooMany: "bl.err.tooMany" } as const

/** Step 2: checks everything and reports what would happen. Writes nothing. */
export async function previewLogins(employeeIds: string[], roleId: string): Promise<PreviewResult> {
  const t = await getT()
  const actor = await assertPerm("users.createBatch")
  const plan = await planBatch(actor, employeeIds, roleId)
  if ("error" in plan) return { error: t(ERR[plan.error], { max: MAX_BATCH }) }
  return { ok: true, role: plan.role.name, count: plan.planned.length, sample: plan.planned.slice(0, 3).map((p) => p.username), skipped: plan.skipped }
}

/** Step 4: creates the logins. The plan is worked out again here, because the preview may be minutes old. */
export async function createLogins(employeeIds: string[], roleId: string): Promise<CreateResult> {
  const t = await getT()
  const actor = await assertPerm("users.createBatch")
  const lim = await rateLimit(`bulklogins:${actor.id}`, 1, 60)
  if (!lim.ok) return { error: t("bl.err.rate", { wait: waitText(lim.retryAfter, t) }) }
  const plan = await planBatch(actor, employeeIds, roleId)
  if ("error" in plan) return { error: t(ERR[plan.error], { max: MAX_BATCH }) }
  if (plan.planned.length === 0) return { error: t("bl.err.nothing") }
  let created: Created[]
  try {
    created = await createFromPlan(plan)
  } catch {
    return { error: t("bl.err.conflict") }
  }
  // the passwords are never written down here: not in the audit log, not in the database (only their hashes), not in the logs
  await audit(actor.id, "bulk-logins", "User", undefined, `${created.length} created, role ${plan.role.name}, ${plan.skipped.length} skipped`)
  revalidatePath("/employees")
  revalidatePath("/settings")
  return { ok: true, created, skipped: plan.skipped, xlsx: await workbook(created, plan, t), days: TEMP_PASSWORD_DAYS }
}

async function workbook(rows: Created[], plan: Plan, t: Awaited<ReturnType<typeof getT>>) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Logins", { views: [{ state: "frozen", ySplit: 3 }] })
  ws.addRow([t("bl.xlsx.warn", { days: TEMP_PASSWORD_DAYS })])
  ws.getRow(1).font = { bold: true, color: { argb: "FFB00020" } }
  ws.addRow([])
  ws.addRow([t("bl.col.no"), t("bl.col.name"), t("bl.col.username"), t("bl.col.password"), t("bl.col.role")])
  ws.getRow(3).font = { bold: true }
  ws.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F1EE" } }
  ws.columns = [{ width: 14 }, { width: 30 }, { width: 18 }, { width: 18 }, { width: 14 }]
  for (const r of rows) ws.addRow([r.employeeNo, r.name, r.username, r.password, plan.role.name])
  // keep spreadsheet programs from treating a password as a formula or number
  for (let i = 4; i < 4 + rows.length; i++) ws.getCell(i, 4).numFmt = "@"
  return Buffer.from(await wb.xlsx.writeBuffer()).toString("base64")
}
