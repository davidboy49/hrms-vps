import { Megaphone } from "lucide-react"
import { db } from "@/lib/db"
import { fmtDate } from "@/lib/format"

/** The latest announcements that have not expired. Shown on the dashboard and on the staff scan page. */
export async function ActiveAnnouncements({ limit = 3 }: { limit?: number }) {
  const rows = await db.announcement.findMany({
    where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  if (rows.length === 0) return null
  return (
    <section className="space-y-2">
      {rows.map((a) => (
        <article key={a.id} className="flex gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <Megaphone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 break-words [overflow-wrap:anywhere]">
            <p className="font-medium">{a.title}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">{fmtDate(a.createdAt)}</p>
          </div>
        </article>
      ))}
    </section>
  )
}
