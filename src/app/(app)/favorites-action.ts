"use server"

import { db } from "@/lib/db"
import { requireUser } from "@/lib/session"

/** Saves the signed-in person's sidebar favourites (site paths only). */
export async function saveFavorites(list: string[]): Promise<void> {
  const user = await requireUser()
  const clean = [...new Set(list)]
    .filter((h): h is string => typeof h === "string" && h.startsWith("/") && !h.startsWith("//") && h.length <= 120)
    .slice(0, 50)
  await db.user.update({ where: { id: user.id }, data: { favorites: clean } })
}
