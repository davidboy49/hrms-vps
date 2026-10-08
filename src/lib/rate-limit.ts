import { headers } from "next/headers"
import { db } from "@/lib/db"

export type Limit = { ok: true } | { ok: false; retryAfter: number }

/**
 * Fixed-window rate limit kept in PostgreSQL, so it is shared by every serverless instance.
 * One atomic upsert per call: the counter resets itself once its window has passed.
 * If the database call fails the request is allowed, so a hiccup does not lock everyone out.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<Limit> {
  try {
    const rows = await db.$queryRaw<{ count: number; age: number }[]>`
      INSERT INTO "RateLimit" ("key", "windowStart", "count")
      VALUES (${key}, now(), 1)
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSec}::float8) THEN 1 ELSE "RateLimit"."count" + 1 END,
        "windowStart" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSec}::float8) THEN now() ELSE "RateLimit"."windowStart" END
      RETURNING "count", EXTRACT(EPOCH FROM (now() - "windowStart"))::float8 AS age`
    const { count, age } = rows[0]
    if (count > limit) return { ok: false, retryAfter: Math.max(1, Math.ceil(windowSec - age)) }
    // tidy up old rows now and then so the table stays small
    if (Math.random() < 0.01) void db.$executeRaw`DELETE FROM "RateLimit" WHERE "windowStart" < now() - interval '1 day'`.catch(() => {})
    return { ok: true }
  } catch (e) {
    console.error("rateLimit failed open:", (e as Error).message)
    return { ok: true }
  }
}

/** Looks at a counter without adding to it, for limits that only count failures. Allows the request if the database call fails. */
export async function rateLimitPeek(key: string, limit: number, windowSec: number): Promise<Limit> {
  try {
    const rows = await db.$queryRaw<{ count: number; age: number }[]>`
      SELECT "count", EXTRACT(EPOCH FROM (now() - "windowStart"))::float8 AS age FROM "RateLimit"
      WHERE "key" = ${key} AND "windowStart" >= now() - make_interval(secs => ${windowSec}::float8)`
    const r = rows[0]
    if (r && r.count >= limit) return { ok: false, retryAfter: Math.max(1, Math.ceil(windowSec - r.age)) }
    return { ok: true }
  } catch (e) {
    console.error("rateLimitPeek failed open:", (e as Error).message)
    return { ok: true }
  }
}

/** Best guess at the caller's IP. Caddy overwrites x-forwarded-for with the real visitor address (see deploy/Caddyfile), so the first entry can be trusted. */
export async function clientIp() {
  const h = await headers()
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim()
}

/** "45 seconds" or "5 minutes", in the viewer's language. */
export const waitText = (seconds: number, t: (key: string, vars?: Record<string, string | number>) => string) =>
  seconds < 90 ? t("wait.seconds", { n: seconds }) : t("wait.minutes", { n: Math.ceil(seconds / 60) })
