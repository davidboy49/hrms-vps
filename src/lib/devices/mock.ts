import { db } from "@/lib/db"
import { fromLocal, localDateKey } from "@/lib/format"
import type { DeviceAdapter, DeviceRow, RawPunch } from "./types"

/** Small deterministic hash so a re-sync produces identical punches (the unique key then dedupes them). */
function h(s: string) {
  let x = 2166136261
  for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619)
  return (x >>> 0) / 4294967296
}
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`

/**
 * Pretends to be a ZKTeco device: for each employee with a PIN at this device's location it produces a
 * check-in around the shift start and a check-out around the shift end, for the last few days.
 */
export class MockAdapter implements DeviceAdapter {
  constructor(private device: DeviceRow) {}

  async testConnection() {
    const users = await db.employee.count({
      where: { deletedAt: null, zkPin: { not: null }, ...(this.device.locationId ? { locationId: this.device.locationId } : {}) },
    })
    return { ok: true, message: "dev.mock.ok", users }
  }

  async fetchPunches(since: Date | null): Promise<RawPunch[]> {
    const emps = await db.employee.findMany({
      where: {
        deletedAt: null,
        zkPin: { not: null },
        status: { countsAsActive: true },
        ...(this.device.locationId ? { locationId: this.device.locationId } : {}),
      },
      select: { zkPin: true, shift: { select: { startTime: true, endTime: true } } },
    })
    const out: RawPunch[] = []
    const now = new Date()
    const DAYS = 5
    for (let back = DAYS - 1; back >= 0; back--) {
      const key = localDateKey(new Date(now.getTime() - back * 86400_000))
      const dow = new Date(key + "T00:00:00Z").getUTCDay()
      if (dow === 0) continue // Sunday off
      for (const e of emps) {
        const pin = e.zkPin!
        const seed = `${this.device.id}|${pin}|${key}`
        if (h(seed + "abs") < 0.05) continue // absent
        const [sh, sm] = (e.shift?.startTime ?? "08:00").split(":").map(Number)
        const [eh, em] = (e.shift?.endTime ?? "17:00").split(":").map(Number)
        const late = h(seed + "late") < 0.18
        const inMin = sh * 60 + sm + Math.round(h(seed + "in") * (late ? 35 : 5)) - (late ? 0 : 20)
        const outMin = eh * 60 + em + Math.round(h(seed + "out") * 50) - 10
        const forgot = h(seed + "forgot") < 0.03
        const tIn = fromLocal(key, hhmm(inMin))
        const tOut = fromLocal(key, hhmm(outMin))
        if (tIn <= now) out.push({ pin, punchedAt: tIn, type: "IN" })
        if (!forgot && tOut <= now) out.push({ pin, punchedAt: tOut, type: "OUT" })
      }
      // one unregistered card or finger now and then
      if (h(`${this.device.id}|${key}|unk`) < 0.5) {
        const t = fromLocal(key, "09:12")
        if (t <= now) out.push({ pin: "9" + String(Math.floor(h(key) * 900) + 100), punchedAt: t, type: "IN" })
      }
    }
    return since ? out.filter((p) => p.punchedAt >= since) : out
  }
}
