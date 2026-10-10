import { db } from "@/lib/db"

/** How pay is worked out. Edited in Payroll → Setup; the pay run (phase 2B) reads it. */
export type PayPolicy = {
  /** "fixed": monthly rate / dayDivisorFixed. "actual": monthly rate / the person's scheduled working days of that month */
  dayDivisorMode: "fixed" | "actual"
  dayDivisorFixed: number
  hoursPerDay: number
  /** "off": lateness is not deducted. "perMinute": late minutes x the minute rate */
  lateDeduction: "off" | "perMinute"
}

export const POLICY_KEYS = { dayDivisorMode: "pay.dayDivisorMode", dayDivisorFixed: "pay.dayDivisorFixed", hoursPerDay: "pay.hoursPerDay", lateDeduction: "pay.lateDeduction" } as const
export const DEFAULT_POLICY: PayPolicy = { dayDivisorMode: "fixed", dayDivisorFixed: 26, hoursPerDay: 8, lateDeduction: "off" }

export async function getPolicy(): Promise<PayPolicy> {
  const rows = await db.setting.findMany({ where: { key: { in: Object.values(POLICY_KEYS) } } })
  const v = (k: string) => rows.find((r) => r.key === k)?.value
  const n = (x: string | undefined, d: number) => (x !== undefined && Number.isFinite(Number(x)) ? Number(x) : d)
  return {
    dayDivisorMode: v(POLICY_KEYS.dayDivisorMode) === "actual" ? "actual" : "fixed",
    dayDivisorFixed: n(v(POLICY_KEYS.dayDivisorFixed), DEFAULT_POLICY.dayDivisorFixed),
    hoursPerDay: n(v(POLICY_KEYS.hoursPerDay), DEFAULT_POLICY.hoursPerDay),
    lateDeduction: v(POLICY_KEYS.lateDeduction) === "perMinute" ? "perMinute" : "off",
  }
}
