#!/usr/bin/env node
// Read-only load test for a TEST copy of PeopleDesk. No dependencies, needs Node 18+.
//
//   node scripts/loadtest.mjs --url https://test.example.com --cookie "pd_session=..." --users 30 --seconds 60 --yes
//
// --url       base address of the test site
// --cookie    your signed-in cookie: sign in with a browser, DevTools > Application > Cookies > copy pd_session
// --users     simultaneous virtual users (default 20)
// --seconds   how long to run (default 30)
// --yes       required when the address is not localhost, so the live site is never hit by accident
// --paths     comma list to override the pages tested
//
// It only does GET requests on pages (never saves, uploads or punches anything). Sign-in is a form action,
// so the test reuses the cookie you give it. Sign in limits do not apply to it.
import { parseArgs } from "node:util"

const { values: a } = parseArgs({
  options: {
    url: { type: "string" }, cookie: { type: "string", default: "" }, users: { type: "string", default: "20" },
    seconds: { type: "string", default: "30" }, paths: { type: "string", default: "" }, yes: { type: "boolean", default: false },
  },
})
if (!a.url) { console.error("Usage: node scripts/loadtest.mjs --url https://test.example.com --cookie \"pd_session=...\" [--users 20] [--seconds 30] --yes"); process.exit(1) }

const base = a.url.replace(/\/$/, "")
const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(base)
if (!local && !a.yes) { console.error(`Refusing to hit ${base} without --yes. Only run this against a TEST site, never the live one.`); process.exit(1) }

const users = Math.max(1, Number(a.users))
const seconds = Math.max(1, Number(a.seconds))
const paths = a.paths ? a.paths.split(",") : ["/login", "/", "/employees", "/attendance", "/attendance?tab=daily", "/leave", "/overtime", "/scan"]
if (!a.cookie) console.warn("No --cookie given: signed-in pages will redirect to /login, so only the login page is really tested.\n")

const stats = new Map(paths.map((p) => [p, { ms: [], codes: new Map(), errors: 0 }]))
const end = Date.now() + seconds * 1000
let total = 0

async function worker(id) {
  let i = id // start each user on a different page
  while (Date.now() < end) {
    const p = paths[i++ % paths.length]
    const s = stats.get(p)
    const t0 = performance.now()
    try {
      const r = await fetch(base + p, { headers: a.cookie ? { cookie: a.cookie } : {}, redirect: "manual" })
      await r.arrayBuffer()
      s.ms.push(performance.now() - t0)
      s.codes.set(r.status, (s.codes.get(r.status) ?? 0) + 1)
    } catch {
      s.errors++
    }
    total++
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 800)) // a person pauses between clicks
  }
}

console.log(`Testing ${base} with ${users} users for ${seconds}s on ${paths.length} pages...\n`)
const t0 = Date.now()
await Promise.all(Array.from({ length: users }, (_, i) => worker(i)))
const took = (Date.now() - t0) / 1000

const pct = (arr, q) => (arr.length ? [...arr].sort((x, y) => x - y)[Math.min(arr.length - 1, Math.floor(arr.length * q))] : 0)
const pad = (s, n) => String(s).padEnd(n)
console.log(pad("page", 26), pad("reqs", 6), pad("p50", 8), pad("p95", 8), pad("max", 8), pad("errors", 7), "status")
let bad = 0
for (const [p, s] of stats) {
  const codes = [...s.codes].map(([c, n]) => `${c}x${n}`).join(" ")
  bad += s.errors + [...s.codes].filter(([c]) => c >= 500).reduce((n, [, k]) => n + k, 0)
  console.log(pad(p, 26), pad(s.ms.length, 6), pad(Math.round(pct(s.ms, 0.5)) + "ms", 8), pad(Math.round(pct(s.ms, 0.95)) + "ms", 8), pad(Math.round(Math.max(0, ...s.ms)) + "ms", 8), pad(s.errors, 7), codes)
}
console.log(`\n${total} requests in ${took.toFixed(1)}s = ${(total / took).toFixed(1)} requests/s, ${bad} failed or 5xx`)
console.log("Good: no failures, p95 under about 1000ms. Redirects (302/307) on signed-in pages mean the cookie is missing or expired.")
process.exit(bad ? 2 : 0)
