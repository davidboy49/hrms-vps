import { db } from "@/lib/db"
import { adapterFor } from "@/lib/devices"
import type { RawPunch } from "@/lib/devices/types"
import { fromLocal, localDateKey, localMinutes } from "@/lib/format"
import { planFor, workWindow } from "@/lib/schedule"

/** Store raw punches, link them to employees by PIN, then rebuild the affected daily rows. */
export async function ingestPunches(deviceId: string, punches: RawPunch[]) {
  if (!punches.length) return { inserted: 0, matched: 0, unknown: 0 }
  const pins = [...new Set(punches.map((p) => p.pin))]
  const emps = await db.employee.findMany({ where: { zkPin: { in: pins }, deletedAt: null }, select: { id: true, zkPin: true } })
  const byPin = new Map(emps.map((e) => [e.zkPin!, e.id]))

  const res = await db.attendancePunch.createMany({
    data: punches.map((p) => ({ deviceId, pin: p.pin, punchedAt: p.punchedAt, type: p.type, employeeId: byPin.get(p.pin) ?? null })),
    skipDuplicates: true,
  })
  const touched = new Map<string, Set<string>>()
  for (const p of punches) {
    const id = byPin.get(p.pin)
    if (!id) continue
    const set = touched.get(id) ?? new Set<string>()
    set.add(localDateKey(p.punchedAt))
    touched.set(id, set)
  }
  for (const [empId, dates] of touched) for (const d of dates) await rebuildDaily(empId, d)
  const unknown = punches.filter((p) => !byPin.has(p.pin)).length
  return { inserted: res.count, matched: punches.length - unknown, unknown }
}

/** Re-link punches whose PIN was unknown at the time (call after assigning a PIN). */
export async function relinkUnknown() {
  const unk = await db.attendancePunch.findMany({ where: { employeeId: null }, select: { id: true, pin: true, punchedAt: true } })
  if (!unk.length) return 0
  const emps = await db.employee.findMany({ where: { zkPin: { in: [...new Set(unk.map((u) => u.pin))] }, deletedAt: null }, select: { id: true, zkPin: true } })
  const byPin = new Map(emps.map((e) => [e.zkPin!, e.id]))
  let n = 0
  const touched = new Map<string, Set<string>>()
  for (const u of unk) {
    const id = byPin.get(u.pin)
    if (!id) continue
    await db.attendancePunch.update({ where: { id: u.id }, data: { employeeId: id } })
    const s = touched.get(id) ?? new Set<string>()
    s.add(localDateKey(u.punchedAt))
    touched.set(id, s)
    n++
  }
  for (const [empId, dates] of touched) for (const d of dates) await rebuildDaily(empId, d)
  return n
}

export async function rebuildDaily(employeeId: string, dateKey: string) {
  const start = fromLocal(dateKey, "00:00")
  const end = new Date(start.getTime() + 86400_000)
  const [punches, emp, plan] = await Promise.all([
    db.attendancePunch.findMany({ where: { employeeId, punchedAt: { gte: start, lt: end } }, orderBy: { punchedAt: "asc" } }),
    db.employee.findUnique({ where: { id: employeeId }, select: { shift: true } }),
    planFor(employeeId, dateKey),
  ])
  if (!punches.length) return
  const firstIn = punches[0].punchedAt
  const lastOut = punches.length > 1 ? punches[punches.length - 1].punchedAt : null
  const workedMin = lastOut ? Math.round((lastOut.getTime() - firstIn.getTime()) / 60000) : 0
  // the shift for this particular day (a roster change or weekly template can differ from the usual shift)
  const shift = plan.kind === "WORK" && plan.shift ? plan.shift : emp?.shift
  const grace = shift?.graceMin ?? 10
  // on a half day of approved leave the expected start (morning leave) or end (afternoon leave) moves to the middle of the shift
  const win = workWindow({ startTime: shift?.startTime ?? "08:00", endTime: shift?.endTime ?? "17:00" }, plan.kind === "WORK" ? plan.half : undefined)
  const lateMin = Math.max(0, localMinutes(firstIn) - (win.start + grace))
  const state = !lastOut ? "INCOMPLETE" : lateMin > 0 ? "LATE" : "PRESENT"
  const date = new Date(dateKey + "T00:00:00.000Z")
  await db.attendanceDaily.upsert({
    where: { employeeId_date: { employeeId, date } },
    update: { firstIn, lastOut, workedMin, lateMin, state },
    create: { employeeId, date, firstIn, lastOut, workedMin, lateMin, state },
  })
}

export async function syncDevice(deviceId: string) {
  const device = await db.device.findUnique({ where: { id: deviceId } })
  if (!device) throw new Error("Device not found")
  const started = new Date()
  try {
    const adapter = adapterFor(device)
    const test = await adapter.testConnection()
    if (!test.ok) throw new Error(test.message)
    const last = await db.attendancePunch.findFirst({ where: { deviceId }, orderBy: { punchedAt: "desc" }, select: { punchedAt: true } })
    // overlap by a day: dedupe handles repeats and catches late-arriving records
    const since = last ? new Date(last.punchedAt.getTime() - 86400_000) : null
    const punches = await adapter.fetchPunches(since)
    const r = await ingestPunches(deviceId, punches)
    await db.device.update({ where: { id: deviceId }, data: { lastSyncAt: new Date(), status: "ONLINE" } })
    await db.syncLog.create({ data: { deviceId, startedAt: started, records: r.inserted, ok: true, message: r.unknown ? `unknown:${r.unknown}` : null } })
    return { ok: true as const, ...r }
  } catch (e) {
    const message = (e as Error).message
    await db.device.update({ where: { id: deviceId }, data: { status: "OFFLINE" } })
    await db.syncLog.create({ data: { deviceId, startedAt: started, records: 0, ok: false, message } })
    return { ok: false as const, message }
  }
}
