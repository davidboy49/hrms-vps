import { db } from "@/lib/db"

/** The HRS system logo, used until a company uploads its own in Settings → Company. */
export const DEFAULT_LOGO = "/brand/hrs-icon.png"
export const DEFAULT_WORDMARK = "/brand/hrs-logo.png"

/** Company name and logo, shared by the sidebar and the sign-in page. */
export async function getBranding(): Promise<{ company: string; logoUrl: string; custom: boolean }> {
  const rows = await db.setting.findMany({ where: { key: { in: ["company.name", "company.logo"] } } })
  const get = (k: string) => rows.find((r) => r.key === k)?.value
  const logo = get("company.logo")
  return {
    company: get("company.name")?.trim() || "PeopleDesk",
    // the file name carries a timestamp, so a new upload gets a new URL and is never served from an old cache
    logoUrl: logo ? `/api/logo?v=${encodeURIComponent(logo.split("/").pop() ?? "")}` : DEFAULT_LOGO,
    custom: Boolean(logo),
  }
}
