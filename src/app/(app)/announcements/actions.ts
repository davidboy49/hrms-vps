"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { assertPerm } from "@/lib/session"
import { audit } from "@/lib/audit"
import { toDate } from "@/lib/format"
import { esc, sendTelegram, tgText } from "@/lib/telegram"
import { rateLimit } from "@/lib/rate-limit"
import { getT } from "@/i18n/server"

const schema = z.object({
  title: z.string().trim().min(1, "ann.err.title").max(120, "ann.err.titleLong"),
  body: z.string().trim().min(1, "ann.err.body").max(2000, "ann.err.bodyLong"),
  expires: z.string().optional(),
})

export type PublishResult = { ok?: boolean; error?: string; telegram?: "sent" | "failed" | "off" }

export async function publishAnnouncement(form: FormData): Promise<PublishResult> {
  const t = await getT()
  const user = await assertPerm("announcements.manage")
  if (!(await rateLimit(`announce:${user.id}`, 20, 3600)).ok) return { error: t("ann.err.rate") }
  const p = schema.safeParse({ title: form.get("title"), body: form.get("body"), expires: String(form.get("expires") ?? "") })
  if (!p.success) return { error: t(p.error.issues[0].message) }
  const expires = p.data.expires ? toDate(p.data.expires) : null
  // an announcement ends at the close of its last day
  const expiresAt = expires ? new Date(expires.getTime() + 86400_000 - 1) : null

  // save first, so a database problem never leaves a message in the group that the app has no record of
  const a = await db.announcement.create({ data: { title: p.data.title, body: p.data.body, authorId: user.id, expiresAt } })

  let telegram: PublishResult["telegram"] = "off"
  if (form.get("telegram") === "on") {
    const text = await tgText("tg.msg.announce", { title: esc(p.data.title), body: esc(p.data.body) })
    const r = await sendTelegram(text, "announce")
    telegram = r.ok ? "sent" : r.skipped ? "off" : "failed"
    if (r.ok) await db.announcement.update({ where: { id: a.id }, data: { sentToTelegram: true } })
  }
  await audit(user.id, "create", "Announcement", a.id, p.data.title)
  revalidatePath("/", "layout")
  return { ok: true, telegram }
}

export async function deleteAnnouncement(id: string) {
  const user = await assertPerm("announcements.manage")
  await db.announcement.delete({ where: { id } }).catch(() => {})
  await audit(user.id, "delete", "Announcement", id)
  revalidatePath("/", "layout")
}
