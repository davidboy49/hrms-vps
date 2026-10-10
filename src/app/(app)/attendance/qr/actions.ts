"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { assertPerm } from "@/lib/session"
import { audit } from "@/lib/audit"
import { makeStaticToken, makeToken } from "@/lib/qr"

/** The token for a location's QR: permanent for printed codes, short-lived for the rotating screen. */
export async function getQrToken(locationId: string) {
  await assertPerm("qr.manage")
  const loc = await db.location.findUnique({ where: { id: locationId }, select: { qrMode: true, qrVersion: true } })
  if (!loc) throw new Error("Location not found")
  return loc.qrMode === "STATIC" ? makeStaticToken(locationId, loc.qrVersion) : makeToken(locationId)
}

/**
 * Invalidates every printed code for this location. Print the new one afterwards.
 * Needs its own permission (qr.regenerate), and the caller must type the location's name, so it cannot happen by a slip.
 */
export async function regenerateQr(locationId: string, confirmName: string): Promise<{ ok?: boolean; error?: string }> {
  const user = await assertPerm("qr.regenerate")
  const loc = await db.location.findUnique({ where: { id: locationId }, select: { name: true } })
  if (!loc) return { error: "Location not found" }
  if (confirmName.trim().toLowerCase() !== loc.name.trim().toLowerCase()) return { error: "name" }
  await db.location.update({ where: { id: locationId }, data: { qrVersion: { increment: 1 } } })
  await audit(user.id, "qr-regenerate", "Location", locationId, loc.name)
  revalidatePath("/attendance/qr")
  return { ok: true }
}
