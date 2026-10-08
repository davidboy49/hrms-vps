import { db } from "@/lib/db"
import { requirePerm } from "@/lib/session"
import { PageHeader } from "@/components/page-header"
import { getT, titleOf } from "@/i18n/server"
import { QrKiosk } from "./kiosk"

export const generateMetadata = titleOf("att.qr")
export const dynamic = "force-dynamic"

export default async function QrPage() {
  const t = await getT()
  await requirePerm("qr.manage")
  const locations = await db.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, latitude: true, longitude: true, qrMode: true } })
  return (
    <>
      <PageHeader title={t("att.qr")} description={t("qr.desc")} />
      <QrKiosk locations={locations.map((l) => ({ id: l.id, name: l.name, geofenced: l.latitude != null && l.longitude != null, mode: l.qrMode }))} />
    </>
  )
}
