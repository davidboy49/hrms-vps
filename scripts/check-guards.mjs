// CI check: every server action, route handler and page must check who is calling, or be on the reviewed list below.
// A new action that forgets its guard fails the build instead of reaching production.  Run: node scripts/check-guards.mjs
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const ROOT = "src"
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p] })
const files = walk(ROOT).filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => f.replaceAll("\\", "/"))

// Anything in here is public or self-service on purpose. Add a line (with the reason) only after a human has decided so.
const PUBLIC_ACTIONS = {
  "src/app/login/actions.ts:login": "sign-in form; rate limited and locks accounts",
  "src/app/login/actions.ts:logout": "ends the caller's own session",
  "src/app/login/2fa/actions.ts:verifyTwoFactor": "second step of sign-in; rate limited",
  "src/app/login/2fa/actions.ts:cancelTwoFactor": "abandons a half-finished sign-in",
  "src/i18n/actions.ts:setLocale": "stores the display language in a cookie",
}
const PUBLIC_ROUTES = {
  "src/app/api/health/route.ts": "uptime probe, returns ok only",
  "src/app/api/logo/route.ts": "company logo shown on the sign-in page",
}
// What counts as "checks who is calling": a permission, an admin check, a session, or a shared secret.
const GUARD = /assertPerm\(|assertAdminRole\(|requirePerm\(|requireUser\(|getSession\(|getPendingPasswordUser\(|\bme\(\)|\bguard\(\)|CRON_SECRET|timingSafeEqual|can\(/

const problems = []
for (const f of files) {
  const src = readFileSync(f, "utf8")
  if (/^\s*["']use server["']/m.test(src.slice(0, 400))) {
    for (const part of src.split(/\n(?=export async function )/).slice(1)) {
      const name = part.match(/^export async function (\w+)/)[1]
      const body = part.split(/\n(?=(?:export )?(?:async )?function |\/\*\*)/)[0]
      if (GUARD.test(body) || `${f}:${name}` in PUBLIC_ACTIONS) continue
      problems.push(`server action ${f}: ${name}() has no permission or session check`)
    }
  }
  if (f.endsWith("/route.ts") && !GUARD.test(src) && !(f in PUBLIC_ROUTES)) problems.push(`route handler ${f} has no permission, session or secret check`)
  if (f.endsWith("/page.tsx") && !GUARD.test(src) && !/\bredirect\(/.test(src)) problems.push(`page ${f} does not require a signed-in user`)
}
if (problems.length) {
  console.error("Guard check failed:\n - " + problems.join("\n - "))
  console.error("\nAdd the right check (assertPerm / requirePerm / getSession), or, if it is public on purpose, list it with a reason in scripts/check-guards.mjs.")
  process.exit(1)
}
console.log(`Guard check passed: ${files.length} files scanned.`)
