"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { distanceM } from "@/lib/qr"
import { rebuildDaily } from "@/lib/attendance"
import { localDateKey } from "@/lib/format"
import { audit } from "@/lib/audit"
import { QR_REASON_KEY, qrDeviceFor, resolveQr } from "@/lib/qr-attendance"
import { rateLimit } from "@/lib/rate-limit"
import { getT } from "@/i18n/server"
import { esc, notifyTelegram, tgText } from "@/lib/telegram"
import { fmtTime } from "@/lib/format"

/** A phone reporting a position less precise than this cannot prove it is at the site. */
const MAX_ACCURACY_M = 100

export type PunchResult = { ok: true; type: "IN" | "OUT"; at: string; location: string } | { ok: false; error: string }

export async function punchByQr(token: string, type: "IN" | "OUT", geo: { lat: number; lng: number; accuracy: number } | null): Promise<PunchResult> {
  const t = await getT()
  const user = await getSession()
  if (!user) return { ok: false, error: t("scan.err.signin") }

  if (!(await rateLimit(`punch:${user.id}`, 10, 60)).ok) return { ok: false, error: t("scan.err.rate") }
  if (type !== "IN" && type !== "OUT") return { ok: false, error: t("scan.err.type") }

  const r = await resolveQr(token)
  if (!r.ok) return { ok: false, error: t(QR_REASON_KEY[r.reason]) }
  const loc = r.loc

  const me = await db.user.findUnique({ where: { id: user.id }, include: { employee: true } })
  if (!me?.isActive) return { ok: false, error: t("scan.err.disabled") }
  if (!me.employee || me.employee.deletedAt) return { ok: false, error: t("scan.err.notLinked") }

  // Location check. A printed (permanent) code relies on it completely, so it is mandatory there.
  const hasCoords = loc.latitude != null && loc.longitude != null
  let distance: number | null = null
  if (r.kind === "static" && !hasCoords) return { ok: false, error: t("scan.err.noCoords", { name: loc.name }) }
  if (hasCoords) {
    if (!geo) return { ok: false, error: t("scan.err.geoRequired") }
    if (r.kind === "static" && geo.accuracy > MAX_ACCURACY_M) return { ok: false, error: t("scan.err.accuracy", { m: Math.round(geo.accuracy) }) }
    distance = distanceM(geo.lat, geo.lng, loc.latitude!, loc.longitude!)
    const allowed = loc.radiusM + Math.min(Math.max(geo.accuracy, 0), 50)
    if (distance > allowed) {
      // someone scanning from outside the allowed distance is worth telling HR about (at most once per 10 minutes per person)
      const who = me.employee
      const metres = Math.round(distance)
      after(async () => notifyTelegram("far", await tgText("tg.msg.far", { name: esc(who.nameEn), no: who.employeeNo, place: esc(loc.name), m: metres, type: await tgText(type === "IN" ? "att.checkIn" : "att.checkOut") }), `far:${who.id}`))
      return { ok: false, error: t("scan.err.far", { m: Math.round(distance), name: loc.name }) }
    }
  }

  const emp = me.employee
  const recent = await db.attendancePunch.findFirst({ where: { employeeId: emp.id, punchedAt: { gte: new Date(Date.now() - 60_000) } } })
  if (recent) return { ok: false, error: t("scan.err.dup") }

  const device = await qrDeviceFor(loc.id, loc.name)
  const now = new Date(Math.floor(Date.now() / 1000) * 1000)
  const pin = emp.zkPin ?? `QR-${emp.employeeNo}`
  await db.attendancePunch.create({
    data: {
      deviceId: device.id,
      pin,
      punchedAt: now,
      type,
      employeeId: emp.id,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      accuracyM: geo ? Math.round(geo.accuracy) : null,
      distanceM: distance === null ? null : Math.round(distance),
    },
  })
  await db.device.update({ where: { id: device.id }, data: { lastSyncAt: now, status: "ONLINE" } })
  await rebuildDaily(emp.id, localDateKey(now))
  // every check-in and check-out, when the group has asked for them (off by default)
  after(async () =>
    notifyTelegram(
      "punch",
      await tgText(type === "IN" ? "tg.msg.in" : "tg.msg.out", { name: esc(emp.nameEn), no: emp.employeeNo, time: fmtTime(now), place: esc(loc.name) }),
    ),
  )
  if (type === "IN") {
    // the first check-in of the day was late: tell the HR group
    const day = await db.attendanceDaily.findUnique({ where: { employeeId_date: { employeeId: emp.id, date: new Date(localDateKey(now) + "T00:00:00.000Z") } } })
    if (day && day.lateMin > 0 && day.firstIn?.getTime() === now.getTime()) {
      after(async () => notifyTelegram("late", await tgText("tg.msg.late", { name: esc(emp.nameEn), no: emp.employeeNo, time: fmtTime(now), m: day.lateMin, place: esc(loc.name) }), `late:${emp.id}:${localDateKey(now)}`))
    }
  }
  await audit(user.id, "qr-punch", "AttendancePunch", undefined, `${type} at ${loc.name}`)
  revalidatePath("/attendance")
  return { ok: true, type, at: now.toISOString(), location: loc.name }
}
