import { timingSafeEqual } from "node:crypto"
import { db } from "@/lib/db"
import { fmtTime, localDateKey } from "@/lib/format"
import { esc, sendTelegram, tgText } from "@/lib/telegram"

export const dynamic = "force-dynamic"

/**
 * Runs every evening (18:30 Cambodia time, Monday to Saturday; scheduled by the server's crontab, see deploy/README.md).
 * Tells the HR group who checked in today but has no check-out yet. The crontab calls it with CRON_SECRET as a bearer token.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const given = req.headers.get("authorization") ?? ""
  const expect = `Bearer ${secret}`
  if (!secret || secret.length < 16 || given.length !== expect.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expect))) return new Response("Unauthorized", { status: 401 })

  const today = new Date(localDateKey(new Date()) + "T00:00:00.000Z")
  const rows = await db.attendanceDaily.findMany({
    where: { date: today, state: "INCOMPLETE", employee: { deletedAt: null } },
    include: { employee: { select: { nameEn: true, employeeNo: true } } },
    orderBy: { employee: { employeeNo: "asc" } },
  })
  if (rows.length === 0) return Response.json({ sent: false, count: 0 })

  const shown = rows.slice(0, 40)
  const lines = shown.map((r) => `• ${esc(r.employee.nameEn)} (${r.employee.employeeNo}) · ${fmtTime(r.firstIn)}`)
  if (rows.length > shown.length) lines.push(`… +${rows.length - shown.length}`)
  const text = await tgText("tg.msg.missing", { n: rows.length, list: lines.join("\n") })
  const r = await sendTelegram(text, "missing")
  return Response.json({ sent: r.ok, count: rows.length, skipped: r.skipped ?? false })
}
