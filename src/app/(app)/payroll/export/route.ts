import { notFound } from "next/navigation"
import ExcelJS from "exceljs"
import { getSession, can } from "@/lib/session"
import { payrollEdition } from "@/lib/edition"
import { audit } from "@/lib/audit"
import { rateLimit } from "@/lib/rate-limit"
import { buildPayrollInput, isMonthKey } from "@/lib/payroll-input"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/** Payroll edition only: the monthly payroll-input sheet as Excel. */
export async function GET(req: Request) {
  if (!payrollEdition()) notFound()
  const user = await getSession()
  if (!user || !can(user, "payroll.export")) return new Response("Forbidden", { status: 403 })
  if (!(await rateLimit(`payroll-export:${user.id}`, 20, 600)).ok) return new Response("Too many exports. Wait a few minutes.", { status: 429 })
  const m = new URL(req.url).searchParams.get("m") ?? ""
  if (!isMonthKey(m)) return new Response("Bad month", { status: 400 })
  const data = await buildPayrollInput(m)
  const company = (await db.setting.findUnique({ where: { key: "company.name" } }))?.value?.trim() || "HR Toch"
  await audit(user.id, "export", "PayrollInput", undefined, `${m}, ${data.rows.length} employees`)

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Payroll input")
  const otCols = data.otTypes.map((t) => ({ header: `OT ${t.code} (h)`, key: `ot_${t.code}`, width: 11 }))
  ws.columns = [
    { header: "Code", key: "no", width: 11 }, { header: "Name", key: "name", width: 26 }, { header: "Department", key: "dep", width: 18 },
    { header: "Rate", key: "rate", width: 11 }, { header: "Basis", key: "basis", width: 8 }, { header: "Currency", key: "cur", width: 9 },
    { header: "Scheduled days", key: "sch", width: 11 }, { header: "Days worked", key: "wk", width: 11 }, { header: "Absent days", key: "ab", width: 11 },
    { header: "Paid leave days", key: "pl", width: 11 }, { header: "Unpaid leave days", key: "ul", width: 11 }, { header: "Worked on day off / holiday", key: "off", width: 13 },
    { header: "Late days", key: "ld", width: 9 }, { header: "Late minutes", key: "lm", width: 10 }, { header: "Days with missing clock-out", key: "inc", width: 13 },
    ...otCols, { header: "OT hours", key: "oth", width: 10 }, { header: "OT weighted hours (x multiplier)", key: "otw", width: 14 },
  ]
  ws.insertRow(1, [`${company} - Payroll input ${m} (${data.from} to ${data.through})`])
  ws.mergeCells(1, 1, 1, 8)
  ws.getCell("A1").font = { bold: true, size: 13 }
  ws.getRow(2).font = { bold: true }
  ws.views = [{ state: "frozen", ySplit: 2, xSplit: 2 }]
  for (const r of data.rows) {
    const row: Record<string, string | number> = {
      no: r.employeeNo, name: r.name, dep: r.department, rate: r.rate, basis: r.rateBasis, cur: r.currency,
      sch: r.scheduled, wk: r.worked, ab: r.absent, pl: r.paidLeave, ul: r.unpaidLeave, off: r.offDayWork, ld: r.lateDays, lm: r.lateMin, inc: r.incomplete,
      oth: r.otHours, otw: r.otWeighted,
    }
    for (const t of data.otTypes) row[`ot_${t.code}`] = r.otBy[t.code] ?? 0
    ws.addRow(row)
  }
  const buf = await wb.xlsx.writeBuffer()
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Payroll-input-${m}.xlsx"`,
    },
  })
}
