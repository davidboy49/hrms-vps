import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/session"
import { entityByKey } from "@/lib/masterdata"
import { PageHeader } from "@/components/page-header"
import { fmtDate } from "@/lib/format"
import { MasterTable, type MRow } from "./master-table"
import { getT } from "@/i18n/server"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ entity: string }> }) {
  const t = await getT()
  const e = entityByKey((await params).entity)
  return { title: e ? t(e.label) : t("nav.masterdata") }
}

export default async function MasterdataPage({ params }: { params: Promise<{ entity: string }> }) {
  const t = await getT()
  const user = await requireRole("HR")
  const { entity } = await params
  const ent = entityByKey(entity)
  if (!ent) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (db as any)[ent.model]
  const rows: Record<string, unknown>[] = await model.findMany({
    orderBy: ent.key === "holidays" ? { date: "asc" } : { name: "asc" },
    ...(ent.hasEmployees ? { include: { _count: { select: { employees: true } } } } : {}),
  })

  // options for relation fields
  const relOpts: Record<string, { value: string; label: string }[]> = {}
  for (const f of ent.fields) {
    if (f.type === "relation" && f.of) {
      const rel = entityByKey(f.of)!
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list: { id: string; name: string }[] = await (db as any)[rel.model].findMany({ orderBy: { name: "asc" } })
      relOpts[f.name] = list.map((x) => ({ value: x.id, label: x.name }))
    }
  }

  const data: MRow[] = rows.map((r) => {
    const values: Record<string, string | boolean> = {}
    const display: Record<string, string> = {}
    for (const f of ent.fields) {
      const raw = r[f.name]
      if (f.type === "bool") {
        values[f.name] = Boolean(raw)
        display[f.name] = raw ? t("common.yes") : t("common.no")
      } else if (f.type === "date") {
        values[f.name] = raw ? new Date(raw as Date).toISOString().slice(0, 10) : ""
        display[f.name] = raw ? fmtDate(raw as Date) : "—"
      } else if (f.type === "relation") {
        values[f.name] = (raw as string | null) ?? ""
        display[f.name] = relOpts[f.name]?.find((o) => o.value === raw)?.label ?? "—"
      } else if (f.type === "select") {
        values[f.name] = String(raw ?? "")
        { const o = f.options?.find((x) => x.value === raw); display[f.name] = o ? t(o.label) : String(raw ?? "—") }
      } else {
        values[f.name] = raw == null ? "" : String(raw)
        display[f.name] = raw == null || raw === "" ? "—" : String(raw)
      }
    }
    return {
      id: r.id as string,
      isActive: r.isActive as boolean,
      count: ent.hasEmployees ? ((r._count as { employees: number }).employees ?? 0) : null,
      values,
      display,
    }
  })

  return (
    <>
      <PageHeader title={t(ent.label)} description={t("md.desc")} />
      <MasterTable
        key={ent.key}
        entityKey={ent.key}
        singular={t(ent.singular)}
        fields={ent.fields}
        relOpts={relOpts}
        rows={data}
        showCount={ent.hasEmployees}
        isAdmin={user.role === "ADMIN"}
      />
    </>
  )
}
