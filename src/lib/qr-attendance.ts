import { db } from "@/lib/db"
import { checkToken } from "@/lib/qr"
import { fromLocal, localDateKey } from "@/lib/format"

/** Finds (or creates) the virtual device that stands for QR scans at a location. */
export async function qrDeviceFor(locationId: string, locationName: string) {
  const existing = await db.device.findFirst({ where: { mode: "QR", locationId } })
  if (existing) return existing
  return db.device.create({ data: { name: `QR · ${locationName}`, model: "Phone QR scan", mode: "QR", locationId, status: "ONLINE" } })
}

/** The type a new punch should have: the opposite of the employee's last punch today. */
export async function suggestedType(employeeId: string): Promise<"IN" | "OUT"> {
  const start = fromLocal(localDateKey(new Date()), "00:00")
  const last = await db.attendancePunch.findFirst({ where: { employeeId, punchedAt: { gte: start } }, orderBy: { punchedAt: "desc" }, select: { type: true } })
  return last?.type === "IN" ? "OUT" : "IN"
}


export type QrResolve =
  | { ok: true; loc: NonNullable<Awaited<ReturnType<typeof db.location.findUnique>>>; kind: "rotating" | "static" }
  | { ok: false; reason: "invalid" | "expired" | "revoked" | "inactive" }

/** Checks a scanned token against the location it names: signature, expiry (rotating) or version (printed). */
export async function resolveQr(token: string): Promise<QrResolve> {
  const c = checkToken(token)
  if (!c.ok) return c
  const loc = await db.location.findUnique({ where: { id: c.locationId } })
  if (!loc || !loc.isActive) return { ok: false, reason: "inactive" }
  if (c.kind === "static") {
    if (loc.qrMode !== "STATIC" || loc.qrVersion !== c.version) return { ok: false, reason: "revoked" }
  } else if (loc.qrMode !== "ROTATING") {
    return { ok: false, reason: "revoked" }
  }
  return { ok: true, loc, kind: c.kind }
}

/** Translation key for each way a scan can be refused. */
export const QR_REASON_KEY = {
  invalid: "scan.err.invalid",
  expired: "scan.err.expired",
  revoked: "scan.err.revoked",
  inactive: "scan.err.locInactive",
} as const
