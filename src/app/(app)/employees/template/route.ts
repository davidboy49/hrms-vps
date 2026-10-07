import { atLeast, getSession } from "@/lib/session"
import { buildWorkbook, TEMPLATE_NOTE_KEYS } from "@/lib/employee-io"
import { getT } from "@/i18n/server"

export async function GET() {
  const user = await getSession()
  if (!user || !atLeast(user.role, "HR")) return new Response("Forbidden", { status: 403 })
  const t = await getT()
  const wb = await buildWorkbook(
    [["", "Sample Person", "", "FEMALE", "1995-06-20", "+855 12 000 000", "sample@company.com", "Operations", "Site Supervisor", "2026-01-15", "Fixed term", "2026-12-31", 600, "MONTH", "USD", "Active", "2001"]],
    "Employees",
    TEMPLATE_NOTE_KEYS.map((k) => t(k)),
  )
  const buf = await wb.xlsx.writeBuffer()
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="employee-import-template.xlsx"',
    },
  })
}
