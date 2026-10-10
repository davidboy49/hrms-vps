"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { assertPerm } from "@/lib/session"
import { isPermission, PAYROLL_PERMISSIONS } from "@/lib/permissions"
import { payrollEdition } from "@/lib/edition"
import { audit } from "@/lib/audit"
import { getT } from "@/i18n/server"

type R = { error?: string; ok?: boolean; id?: string }

function clean(input: { name: string; description?: string; permissions: string[] }) {
  return {
    name: input.name.trim().slice(0, 60),
    description: (input.description ?? "").trim().slice(0, 200),
    permissions: [...new Set(input.permissions.filter(isPermission).filter((p) => payrollEdition() || !PAYROLL_PERMISSIONS.includes(p)))],
  }
}

export async function saveRole(id: string | null, input: { name: string; description?: string; permissions: string[] }): Promise<R> {
  const t = await getT()
  const user = await assertPerm("roles.manage")
  const d = clean(input)
  if (!d.name) return { error: t("roles.err.name") }
  const dup = await db.appRole.findFirst({ where: { name: { equals: d.name, mode: "insensitive" }, ...(id ? { NOT: { id } } : {}) } })
  if (dup) return { error: t("roles.err.dup") }

  if (id) {
    const cur = await db.appRole.findUnique({ where: { id } })
    if (!cur) return { error: t("roles.err.missing") }
    // the Admin role always has everything and keeps its name; other built-in roles can be re-tuned
    if (cur.key === "ADMIN") return { error: t("roles.err.admin") }
    await db.appRole.update({ where: { id }, data: { permissions: d.permissions, description: d.description, ...(cur.isSystem ? {} : { name: d.name }) } })
    // people in this role pick up the change on their next request; no sign-out needed
    await audit(user.id, "update", "Role", id, cur.name)
    revalidatePath("/settings")
    return { ok: true, id }
  }
  const created = await db.appRole.create({ data: d })
  await audit(user.id, "create", "Role", created.id, created.name)
  revalidatePath("/settings")
  return { ok: true, id: created.id }
}

export async function deleteRole(id: string): Promise<R> {
  const t = await getT()
  const user = await assertPerm("roles.manage")
  const role = await db.appRole.findUnique({ where: { id }, include: { _count: { select: { users: true } } } })
  if (!role) return { error: t("roles.err.missing") }
  if (role.isSystem) return { error: t("roles.err.system") }
  if (role._count.users > 0) return { error: t("roles.err.inUse", { n: role._count.users }) }
  await db.appRole.delete({ where: { id } })
  await audit(user.id, "delete", "Role", id, role.name)
  revalidatePath("/settings")
  return { ok: true }
}
