import { getSession, can } from "@/lib/session"
import { buildLogRows, buildLogWorkbookBuffer, LOG_HEADERS } from "@/lib/attendance-log"
import { audit } from "@/lib/audit"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

/** Downloads the attendance log for the current Punches filter, in the company's "Attendance Logs" layout. */
export async function GET(req: Request) {
  const user = await getSession()
  if (!user || !can(user, "attendance.export")) return new Response("Forbidden", { status: 403 })
  if (!(await rateLimit(`export:${user.id}`, 30, 600)).ok) return new Response("Too many exports. Wait a few minutes.", { status: 429 })
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries())
  const { rows, company } = await buildLogRows(sp)
  await audit(user.id, "export", "AttendanceLog", undefined, `${rows.length} rows`)

  if (sp.format === "csv") {
    const esc = (v: string | number) => {
      const s = String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = "﻿" + [LOG_HEADERS, ...rows].map((r) => r.map(esc).join(",")).join("\r\n")
    return new Response(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="Attendance-Logs.csv"' },
    })
  }
  const buf = await buildLogWorkbookBuffer(company, rows)
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Attendance-Logs.xlsx"',
    },
  })
}
