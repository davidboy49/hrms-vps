import { db } from "@/lib/db"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { readPhoto, s3Configured } from "@/lib/uploads"

/** The company logo. It is public on purpose: the sign-in page shows it before anyone is signed in. */
export async function GET() {
  if (!(await rateLimit(`logo:${await clientIp()}`, 240, 60)).ok) return new Response("Too many requests", { status: 429 })
  const row = await db.setting.findUnique({ where: { key: "company.logo" } })
  const ref = row?.value
  if (!ref) return new Response("Not found", { status: 404 })

  // local development only: the file sits in public/uploads
  if (ref.startsWith("/uploads/") && !ref.includes("..")) return new Response(null, { status: 302, headers: { Location: ref } })
  if (!ref.startsWith("s3:") || !s3Configured()) return new Response("Not found", { status: 404 })
  const key = ref.slice(3)
  if (!key.startsWith("branding/") || key.includes("..")) return new Response("Not found", { status: 404 })
  try {
    const p = await readPhoto(key)
    return new Response(p.body, {
      headers: {
        "Content-Type": p.type,
        ...(p.length ? { "Content-Length": String(p.length) } : {}),
        // the URL changes whenever the logo does, so it can be cached for a long time
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
