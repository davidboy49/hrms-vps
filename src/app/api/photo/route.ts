import { atLeast, getSession } from "@/lib/session"
import { db } from "@/lib/db"
import { rateLimit } from "@/lib/rate-limit"
import { readPhoto, s3Configured } from "@/lib/uploads"

/** Streams a private photo from the private storage bucket to signed-in users only. */
export async function GET(req: Request) {
  const user = await getSession()
  if (!user) return new Response("Unauthorized", { status: 401 })
  const key = new URL(req.url).searchParams.get("key") ?? ""
  if (!(await rateLimit(`photo:${user.id}`, 1000, 300)).ok) return new Response("Too many requests", { status: 429 })
  // staff with the Employee role may only load their own photo
  if (!atLeast(user.role, "MANAGER") && !key.startsWith("branding/")) {
    const own = await db.user.findUnique({ where: { id: user.id }, select: { employee: { select: { photoUrl: true } } } })
    if (own?.employee?.photoUrl !== `s3:${key}`) return new Response("Not found", { status: 404 })
  }
  if (!s3Configured() || !(key.startsWith("employees/") || key.startsWith("branding/")) || key.includes("..")) return new Response("Not found", { status: 404 })
  try {
    const p = await readPhoto(key)
    return new Response(p.body, {
      headers: {
        "Content-Type": p.type,
        ...(p.length ? { "Content-Length": String(p.length) } : {}),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
