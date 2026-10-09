"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { assertPerm } from "@/lib/session"
import { audit } from "@/lib/audit"
import { encryptSecret } from "@/lib/crypto-secret"
import { rateLimit, waitText } from "@/lib/rate-limit"
import { botInfo, esc, recentChats, sendTelegram, tgConfig, tgText } from "@/lib/telegram"
import { getT } from "@/i18n/server"

type R = { ok?: boolean; error?: string; bot?: string }

const put = (key: string, value: string) => db.setting.upsert({ where: { key }, update: { value }, create: { key, value } })

/** Saves the Telegram connection. The token is checked with Telegram, then stored encrypted; it is never sent back to the browser. */
export async function saveTelegram(form: FormData): Promise<R> {
  const t = await getT()
  const user = await assertPerm("settings.notifications")
  const lim = await rateLimit(`tg-save:${user.id}`, 20, 600)
  if (!lim.ok) return { error: t("tg.err.rate", { wait: waitText(lim.retryAfter, t) }) }

  const chatId = String(form.get("chatId") ?? "").trim()
  if (chatId && !/^(-?\d{5,20}|@[A-Za-z0-9_]{4,32})$/.test(chatId)) return { error: t("tg.err.chat") }

  let bot: string | undefined
  const token = String(form.get("token") ?? "").trim()
  if (token) {
    if (!/^\d{6,12}:[A-Za-z0-9_-]{30,60}$/.test(token)) return { error: t("tg.err.tokenFormat") }
    const me = await botInfo(token)
    if (!me.ok) return { error: t("tg.err.tokenRejected", { why: me.error }) }
    await put("tg.token", encryptSecret(token))
    bot = me.result.username
  }
  if (form.get("clearToken") === "1") {
    await db.setting.deleteMany({ where: { key: "tg.token" } })
    await put("tg.enabled", "0")
  }

  await put("tg.chatId", chatId)
  await put("tg.lang", form.get("lang") === "en" ? "en" : "km")
  await put("tg.enabled", form.get("enabled") === "on" && form.get("clearToken") !== "1" ? "1" : "0")
  for (const k of ["late", "far", "missing", "announce", "punch", "leave"]) await put(`tg.${k}`, form.get(k) === "on" ? "1" : "0")

  await audit(user.id, "update", "Setting", undefined, "telegram notifications")
  revalidatePath("/settings")
  return { ok: true, bot }
}

export async function testTelegram(): Promise<R> {
  const t = await getT()
  const user = await assertPerm("settings.notifications")
  const lim = await rateLimit(`tg-test:${user.id}`, 10, 600)
  if (!lim.ok) return { error: t("tg.err.rate", { wait: waitText(lim.retryAfter, t) }) }
  const r = await sendTelegram(await tgText("tg.msg.test", { name: esc(user.name) }))
  if (r.skipped) return { error: t("tg.err.notReady") }
  return r.ok ? { ok: true } : { error: t("tg.err.sendFailed", { why: r.error ?? "" }) }
}

/** Lists chats the bot has seen, so the admin can pick the group. The bot must have received a message since it was added. */
export async function findTelegramChats(): Promise<{ chats?: { id: number; title: string; type: string }[]; error?: string }> {
  const t = await getT()
  const user = await assertPerm("settings.notifications")
  const lim = await rateLimit(`tg-find:${user.id}`, 20, 600)
  if (!lim.ok) return { error: t("tg.err.rate", { wait: waitText(lim.retryAfter, t) }) }
  const { token } = await tgConfig()
  if (!token) return { error: t("tg.err.saveTokenFirst") }
  const r = await recentChats(token)
  if (!r.ok) return { error: t("tg.err.sendFailed", { why: r.error }) }
  return { chats: r.result }
}
