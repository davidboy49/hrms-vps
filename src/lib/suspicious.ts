import { db } from "@/lib/db"
import { distanceM } from "@/lib/qr"
import { fromLocal, localDateKey } from "@/lib/format"

/**
 * Hints that a check-in position may be faked. Worked out when someone opens the Suspicious tab from the punches already stored,
 * so nothing is recorded per punch and old data is covered too. A hint is never proof: real GPS never repeats to the decimetre,
 * but a phone can occasionally return a cached position, so everything here reads "needs checking", not "cheating".
 */
export type Level = "low" | "medium" | "high"
export type RuleKey = "sameSpot" | "sharedSpot" | "deadCentre" | "tooFast" | "oddAccuracy"
export type Severity = "likely" | "check" | "hint"
export type RuleHit = { key: RuleKey; n: number; vars: Record<string, string | number> }
export type Finding = { employeeId: string; employeeNo: string; name: string; department: string; severity: Severity; punches: number; rules: RuleHit[] }

/** The thresholds per sensitivity. Stricter = fewer repeats needed before something shows. */
const T: Record<Level, { sameSpot: number; sharedPeople: number; deadCentre: number; speedKmh: number; accuracyRepeat: number }> = {
  low: { sameSpot: 10, sharedPeople: 3, deadCentre: 3, speedKmh: 250, accuracyRepeat: 15 },
  medium: { sameSpot: 6, sharedPeople: 2, deadCentre: 2, speedKmh: 150, accuracyRepeat: 10 },
  high: { sameSpot: 4, sharedPeople: 2, deadCentre: 1, speedKmh: 100, accuracyRepeat: 6 },
}
export const MAX_RANGE_DAYS = 31
const MIN_JUMP_M = 500
const cell = (lat: number, lng: number) => `${lat.toFixed(6)},${lng.toFixed(6)}`

export function parseRange(from?: string, to?: string, today = localDateKey(new Date())) {
  const ok = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null)
  let b = ok(to) ?? today
  let a = ok(from) ?? localDateKey(new Date(Date.parse(b + "T00:00:00Z") - 13 * 86400_000))
  if (a > b) [a, b] = [b, a]
  const minA = localDateKey(new Date(Date.parse(b + "T00:00:00Z") - (MAX_RANGE_DAYS - 1) * 86400_000))
  if (a < minA) a = minA
  return { from: a, to: b }
}

type P = { employeeId: string; at: Date; lat: number; lng: number; acc: number | null; dist: number | null }

export async function findSuspicious(from: string, to: string, level: Level): Promise<Finding[]> {
  const th = T[level]
  const start = fromLocal(from, "00:00")
  const end = new Date(fromLocal(to, "00:00").getTime() + 86400_000)
  const rows = await db.attendancePunch.findMany({
    where: { punchedAt: { gte: start, lt: end }, employeeId: { not: null }, lat: { not: null }, lng: { not: null } },
    orderBy: { punchedAt: "asc" },
    take: 300_000,
    select: { employeeId: true, punchedAt: true, lat: true, lng: true, accuracyM: true, distanceM: true },
  })
  const pts: P[] = rows.map((r) => ({ employeeId: r.employeeId!, at: r.punchedAt, lat: r.lat!, lng: r.lng!, acc: r.accuracyM, dist: r.distanceM }))
  const byEmp = new Map<string, P[]>()
  for (const p of pts) (byEmp.get(p.employeeId) ?? byEmp.set(p.employeeId, []).get(p.employeeId)!).push(p)

  const hits = new Map<string, RuleHit[]>()
  const add = (id: string, h: RuleHit) => (hits.get(id) ?? hits.set(id, []).get(id)!).push(h)

  // R1: the same position to ~0.1 m, again and again
  for (const [id, list] of byEmp) {
    const groups = new Map<string, P[]>()
    for (const p of list) (groups.get(cell(p.lat, p.lng)) ?? groups.set(cell(p.lat, p.lng), []).get(cell(p.lat, p.lng))!).push(p)
    let best: [string, P[]] | null = null
    for (const g of groups) if (!best || g[1].length > best[1].length) best = g
    if (best && best[1].length >= th.sameSpot) add(id, { key: "sameSpot", n: best[1].length, vars: { n: best[1].length, pos: best[0] } })
  }

  // R2: the identical position shared by different people (same day, or any day in the range at High)
  const shared = new Map<string, Set<string>>()
  for (const p of pts) {
    const k = `${level === "high" ? "" : localDateKey(p.at) + "|"}${cell(p.lat, p.lng)}`
    ;(shared.get(k) ?? shared.set(k, new Set()).get(k)!).add(p.employeeId)
  }
  const sharedHits = new Map<string, { others: Set<string>; pos: string }>()
  for (const [k, ids] of shared) {
    if (ids.size < th.sharedPeople) continue
    const pos = k.split("|").pop()!
    for (const id of ids) {
      const cur = sharedHits.get(id) ?? sharedHits.set(id, { others: new Set(), pos }).get(id)!
      for (const o of ids) if (o !== id) cur.others.add(o)
    }
  }

  // R3: standing exactly on the site's configured point is practically impossible for a real phone
  for (const [id, list] of byEmp) {
    const n = list.filter((p) => p.dist !== null && p.dist <= 1).length
    if (n >= th.deadCentre) add(id, { key: "deadCentre", n, vars: { n } })
  }

  // R4: positions that change faster than a person can travel
  for (const [id, list] of byEmp) {
    let n = 0
    let example = ""
    for (let i = 1; i < list.length; i++) {
      const dt = (list[i].at.getTime() - list[i - 1].at.getTime()) / 3600_000
      if (dt <= 0) continue
      const d = distanceM(list[i - 1].lat, list[i - 1].lng, list[i].lat, list[i].lng)
      if (d > MIN_JUMP_M && d / 1000 / dt > th.speedKmh) {
        n++
        if (!example) example = `${Math.round(d / 100) / 10} km in ${Math.max(1, Math.round(dt * 60))} min, ${localDateKey(list[i].at)}`
      }
    }
    if (n > 0) add(id, { key: "tooFast", n, vars: { n, kmh: th.speedKmh, ex: example } })
  }

  // R5: the phone claims exactly the same accuracy nearly every time (a supporting hint only)
  for (const [id, list] of byEmp) {
    const counts = new Map<number, number>()
    for (const p of list) if (p.acc !== null) counts.set(p.acc, (counts.get(p.acc) ?? 0) + 1)
    for (const [v, c] of counts) if (c >= th.accuracyRepeat && c / list.length >= 0.9) add(id, { key: "oddAccuracy", n: c, vars: { v, n: c, total: list.length } })
  }

  const ids = [...new Set([...hits.keys(), ...sharedHits.keys()])]
  if (ids.length === 0) return []
  const emps = await db.employee.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, employeeNo: true, nameEn: true, department: { select: { name: true } } } })
  const empBy = new Map(emps.map((e) => [e.id, e]))
  const out: Finding[] = []
  for (const id of ids) {
    const e = empBy.get(id)
    if (!e) continue
    const rules = [...(hits.get(id) ?? [])]
    const s = sharedHits.get(id)
    if (s) {
      const names = [...s.others].map((o) => empBy.get(o)?.nameEn ?? "?").slice(0, 4).join(", ")
      rules.push({ key: "sharedSpot", n: s.others.size, vars: { n: s.others.size, pos: s.pos, who: names } })
    }
    const has = (k: RuleKey) => rules.some((r) => r.key === k)
    const severity: Severity = has("deadCentre") || has("tooFast") || (has("sameSpot") && has("sharedSpot")) ? "likely" : has("sameSpot") || has("sharedSpot") ? "check" : "hint"
    out.push({ employeeId: id, employeeNo: e.employeeNo, name: e.nameEn, department: e.department.name, severity, punches: byEmp.get(id)?.length ?? 0, rules })
  }
  const rank: Record<Severity, number> = { likely: 0, check: 1, hint: 2 }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || b.rules.length - a.rules.length || a.employeeNo.localeCompare(b.employeeNo)).slice(0, 500)
}
