import { db } from "@/lib/db"
import { decryptSecret } from "@/lib/crypto-secret"
import { rateLimit } from "@/lib/rate-limit"
import { dictFor } from "@/i18n/server"
import { translate, type Vars } from "@/i18n/core"

/** What can be sent to the HR Telegram group. Each kind can be switched off in Settings → Notifications. */
export type TgKind = "late" | "far" | "missing" | "announce" | "punch"

export const TG_KEYS = ["tg.token", "tg.chatId", "tg.enabled", "tg.lang", "tg.late", "tg.far", "tg.missing", "tg.announce", "tg.punch"] as const

export type TgConfig = {
  token: string | null
  chatId: string
  enabled: boolean
  lang: "km" | "en"
  flags: Record<TgKind, boolean>
}

export async function tgConfig(): Promise<TgConfig> {
  const rows = await db.setting.findMany({ where: { key: { in: [...TG_KEYS] } } })
  const get = (k: string) => rows.find((r) => r.key === k)?.value
  // the exception alerts are on unless someone has switched them off; every-punch alerts are opt-in
  const on = (k: string) => get(k) !== "0"
  const stored = get("tg.token")
  return {
    token: stored ? decryptSecret(stored) : null,
    chatId: get("tg.chatId") ?? "",
    enabled: get("tg.enabled") === "1",
    lang: get("tg.lang") === "en" ? "en" : "km",
    flags: { late: on("tg.late"), far: on("tg.far"), missing: on("tg.missing"), announce: on("tg.announce"), punch: get("tg.punch") === "1" },
  }
}

/** Telegram's HTML mode needs these three characters escaped; names and announcement text come from users. */
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

type ApiResult<T> = { ok: true; result: T } | { ok: false; error: string }

async function api<T>(token: string, method: string, body?: object): Promise<ApiResult<T>> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 6000)
  try {
    // TELEGRAM_API_BASE exists so the messages can be tested against a local stand-in; production uses Telegram itself
    const res = await fetch(`${process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org"}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: ctl.signal,
      cache: "no-store",
    })
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string }
    return json.ok ? { ok: true, result: json.result as T } : { ok: false, error: json.description ?? `HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, error: (e as Error).name === "AbortError" ? "Telegram did not answer in time" : (e as Error).message }
  } finally {
    clearTimeout(timer)
  }
}

export async function botInfo(token: string) {
  return api<{ id: number; username: string; first_name: string }>(token, "getMe")
}

/** Chats the bot has recently seen, so the admin can pick the group instead of typing an ID. */
export async function recentChats(token: string) {
  type Chat = { id: number; title?: string; first_name?: string; type: string }
  const r = await api<{ message?: { chat: Chat }; my_chat_member?: { chat: Chat } }[]>(token, "getUpdates", { limit: 100, allowed_updates: ["message", "my_chat_member"] })
  if (!r.ok) return r
  const seen = new Map<number, { id: number; title: string; type: string }>()
  for (const u of r.result) {
    const c = u.message?.chat ?? u.my_chat_member?.chat
    if (c) seen.set(c.id, { id: c.id, title: c.title ?? c.first_name ?? String(c.id), type: c.type })
  }
  return { ok: true as const, result: [...seen.values()] }
}

/** Sends one message to the configured chat. Never throws: a Telegram problem must not break a scan. */
export async function sendTelegram(text: string, kind?: TgKind): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const cfg = await tgConfig()
  if (!cfg.token || !cfg.chatId) return { ok: false, error: "not configured", skipped: true }
  if (kind && !(cfg.enabled && cfg.flags[kind])) return { ok: false, skipped: true }
  const r = await api(cfg.token, "sendMessage", { chat_id: cfg.chatId, text, parse_mode: "HTML", disable_web_page_preview: true })
  return r.ok ? { ok: true } : { ok: false, error: r.error }
}

/** A translated message in the language chosen for the group. */
export async function tgText(key: string, vars?: Vars) {
  const { lang } = await tgConfig()
  return translate(dictFor(lang), key, vars)
}

/** Fire-and-forget alert. The same key is sent at most once every 10 minutes, so a repeat offender cannot flood the group. */
export async function notifyTelegram(kind: TgKind, text: string, dedupeKey?: string) {
  if (dedupeKey && !(await rateLimit(`tg:${dedupeKey}`, 1, 600)).ok) return
  const r = await sendTelegram(text, kind)
  if (!r.ok && !r.skipped) console.error("telegram send failed:", r.error)
}
