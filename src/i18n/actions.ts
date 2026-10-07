"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { LOCALE_COOKIE } from "./core"

export async function setLocale(locale: string) {
  const value = locale === "en" ? "en" : "km"
  const jar = await cookies()
  jar.set(LOCALE_COOKIE, value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.NODE_ENV === "production" })
  revalidatePath("/", "layout")
}
