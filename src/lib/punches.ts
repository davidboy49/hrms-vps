import type { Prisma } from "@prisma/client"
import { fromLocal } from "@/lib/format"
import type { SP } from "@/lib/employees"

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""
const many = (v: string | string[] | undefined) =>
  one(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

export type PunchFilters = {
  q: string
  from: string
  to: string
  device: string[]
  dept: string[]
  type: "" | "IN" | "OUT"
  match: "" | "matched" | "unknown"
}

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

export function parsePunchFilters(sp: SP): PunchFilters {
  const type = one(sp.type)
  const match = one(sp.match)
  return {
    q: one(sp.q).trim(),
    from: isDay(one(sp.from)) ? one(sp.from) : "",
    to: isDay(one(sp.to)) ? one(sp.to) : "",
    device: many(sp.device),
    dept: many(sp.dept),
    type: type === "IN" || type === "OUT" ? type : "",
    match: match === "matched" || match === "unknown" ? match : "",
  }
}

export function buildPunchWhere(f: PunchFilters): Prisma.AttendancePunchWhereInput {
  const and: Prisma.AttendancePunchWhereInput[] = []
  if (f.q)
    and.push({
      OR: [
        { pin: { contains: f.q } },
        { employee: { nameEn: { contains: f.q, mode: "insensitive" } } },
        { employee: { employeeNo: { contains: f.q, mode: "insensitive" } } },
      ],
    })
  // dates are calendar days in the app time zone
  if (f.from || f.to) {
    and.push({
      punchedAt: {
        ...(f.from ? { gte: fromLocal(f.from, "00:00") } : {}),
        ...(f.to ? { lt: new Date(fromLocal(f.to, "00:00").getTime() + 86400_000) } : {}),
      },
    })
  }
  if (f.device.length) and.push({ deviceId: { in: f.device } })
  if (f.dept.length) and.push({ employee: { departmentId: { in: f.dept } } })
  if (f.type) and.push({ type: f.type })
  if (f.match === "matched") and.push({ employeeId: { not: null } })
  if (f.match === "unknown") and.push({ employeeId: null })
  return and.length ? { AND: and } : {}
}
