import { db } from "@/lib/db"
import { requireRole } from "@/lib/session"
import { tgConfig } from "@/lib/telegram"
import { fmtDate, fmtDateTime } from "@/lib/format"
import { getT, titleOf } from "@/i18n/server"
import { PageHeader } from "@/components/page-header"
import { AnnouncementForm, AnnouncementList } from "./announcement-form"

export const generateMetadata = titleOf("nav.announcements")
export const dynamic = "force-dynamic"

export default async function AnnouncementsPage() {
  const t = await getT()
  await requireRole("HR")
  const [rows, cfg] = await Promise.all([
    db.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { author: { select: { name: true } } } }),
    tgConfig(),
  ])
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  return (
    <>
      <PageHeader title={t("nav.announcements")} description={t("ann.desc")} />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <AnnouncementForm telegramReady={Boolean(cfg.token && cfg.chatId && cfg.enabled && cfg.flags.announce)} />
        <AnnouncementList
          rows={rows.map((a) => ({
            id: a.id,
            title: a.title,
            body: a.body,
            when: fmtDateTime(a.createdAt),
            expires: a.expiresAt ? fmtDate(a.expiresAt) : null,
            author: a.author?.name ?? "—",
            telegram: a.sentToTelegram,
            active: !a.expiresAt || a.expiresAt.getTime() > now,
          }))}
        />
      </div>
    </>
  )
}
