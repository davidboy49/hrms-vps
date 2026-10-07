import { db } from "@/lib/db"

export async function audit(userId: string | null, action: string, entity: string, entityId?: string, detail?: string) {
  try {
    await db.auditLog.create({ data: { userId, action, entity, entityId, detail } })
  } catch {}
}
