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

/** Invalidates every printed code for this location. Print the new one afterwards. */
export async function regenerateQr(locationId: string) {
  const user = await assertPerm("qr.manage")
  await db.location.update({ where: { id: locationId }, data: { qrVersion: { increment: 1 } } })
  await audit(user.id, "qr-regenerate", "Location", locationId)
  revalidatePath("/attendance/qr")
}
