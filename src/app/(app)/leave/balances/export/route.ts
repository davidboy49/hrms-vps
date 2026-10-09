import ExcelJS from "exceljs"
import { db } from "@/lib/db"
import { getSession, can } from "@/lib/session"
import { balancesFor } from "@/lib/leave"
import { localDateKey } from "@/lib/format"
import { audit } from "@/lib/audit"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

/** Everyone's leave quota for a year as an Excel file: allowance, used, waiting and left, per leave type. */
export async function GET(req: Request) {
  const user = await getSession()
  if (!user || !can(user, "leave.viewAll")) return new Response("Forbidden", { status: 403 })
  if (!(await rateLimit(`export:${user.id}`, 30, 600)).ok) return new Response("Too many exports. Wait a few minutes.", { status: 429 })
  const y = Number(new URL(req.url).searchParams.get("year"))
  const year = Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : Number(localDateKey(new Date()).slice(0, 4))

  const [types, emps] = await Promise.all([
    db.leaveType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.employee.findMany({ where: { deletedAt: null, status: { countsAsActive: true } }, orderBy: { employeeNo: "asc" }, select: { id: true, employeeNo: true, nameEn: true, department: { select: { name: true } } } }),
  ])
  const bals = await balancesFor(emps.map((e) => e.id), year)

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(`Leave ${year}`, { views: [{ state: "frozen", ySplit: 1, xSplit: 2 }] })
  ws.addRow(["Staff ID", "Name", "Department", ...types.flatMap((x) => [`${x.name}: allowance`, `${x.name}: used`, `${x.name}: waiting`, `${x.name}: left`])])
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F1EE" } }
  ws.getColumn(1).width = 12
  ws.getColumn(2).width = 28
  ws.getColumn(3).width = 18
  for (const e of emps) {
    const row: (string | number)[] = [e.employeeNo, e.nameEn, e.department.name]
    for (const x of types) {
      const b = bals.get(e.id)?.find((y2) => y2.typeId === x.id)
      if (!b) row.push("", "", "", "")
      else row.push(b.allowance ?? "no limit", b.used, b.pending, b.allowance == null ? "no limit" : b.allowance - b.used - b.pending)
    }
    ws.addRow(row)
  }
  await audit(user.id, "export", "LeaveBalance", undefined, `${year}, ${emps.length} rows`)
  const buf = await wb.xlsx.writeBuffer()
  return new Response(buf as ArrayBuffer, {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="leave-balances-${year}.xlsx"` },
  })
}
