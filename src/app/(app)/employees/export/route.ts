import { db } from "@/lib/db"
import { getSession, can } from "@/lib/session"
import { buildOrderBy, buildWhere, employeeInclude, parseFilters } from "@/lib/employees"
import { buildWorkbook, employeeRow, HEADERS } from "@/lib/employee-io"
import { audit } from "@/lib/audit"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const user = await getSession()
  if (!user || !can(user, "employees.export")) return new Response("Forbidden", { status: 403 })
  if (!(await rateLimit(`export:${user.id}`, 30, 600)).ok) return new Response("Too many exports. Wait a few minutes.", { status: 429 })
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries())
  const ids = sp.ids ? sp.ids.split(",").filter(Boolean) : undefined
  const emps = await db.employee.findMany({
    where: buildWhere(parseFilters(sp), ids),
    include: employeeInclude,
    orderBy: buildOrderBy(sp.sort ?? "employeeNo", sp.dir ?? "asc"),
  })
  const rows = emps.map(employeeRow)
  const stamp = new Date().toISOString().slice(0, 10)
  await audit(user.id, "export", "Employee", undefined, `${rows.length} rows`)

  if (sp.format === "csv") {
    const esc = (v: string | number) => {
      const s = String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = "﻿" + [HEADERS as readonly string[], ...rows].map((r) => r.map(esc).join(",")).join("\r\n")
    return new Response(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="employees-${stamp}.csv"` },
    })
  }
  const wb = await buildWorkbook(rows)
  const buf = await wb.xlsx.writeBuffer()
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="employees-${stamp}.xlsx"`,
    },
  })
}
