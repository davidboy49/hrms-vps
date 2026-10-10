import { db } from "@/lib/db"
import { can, requirePerm } from "@/lib/session"
import { PageHeader } from "@/components/page-header"
import { getT, titleOf } from "@/i18n/server"
import { QrKiosk } from "./kiosk"
import { fmtDateTime } from "@/lib/format"

export const generateMetadata = titleOf("att.qr")
export const dynamic = "force-dynamic"

export default async function QrPage() {
  const t = await getT()
  const user = await requirePerm("qr.manage")
  const locations = await db.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, latitude: true, longitude: true, qrMode: true } })
  // who last regenerated each location's code, and when (from the audit log)
  const regens = await db.auditLog.findMany({ where: { action: "qr-regenerate", entityId: { in: locations.map((l) => l.id) } }, orderBy: { createdAt: "desc" }, select: { entityId: true, userId: true, createdAt: true } })
  const lastBy = new Map<string, (typeof regens)[number]>()
  for (const r of regens) if (r.entityId && !lastBy.has(r.entityId)) lastBy.set(r.entityId, r)
  const names = new Map((await db.user.findMany({ where: { id: { in: [...new Set([...lastBy.values()].map((r) => r.userId).filter((x): x is string => !!x))] } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]))
  return (
    <>
      <PageHeader title={t("att.qr")} description={t("qr.desc")} />
      <QrKiosk
        canRegenerate={can(user, "qr.regenerate")}
        locations={locations.map((l) => {
          const r = lastBy.get(l.id)
          return { id: l.id, name: l.name, geofenced: l.latitude != null && l.longitude != null, mode: l.qrMode, lastRegen: r ? `${fmtDateTime(r.createdAt)} · ${(r.userId && names.get(r.userId)) || "?"}` : null }
        })}
      />
    </>
  )
}
