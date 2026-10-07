export type Locale = "km" | "en"
export type Dict = Record<string, string>
export type Vars = Record<string, string | number>

export const LOCALES: { code: Locale; label: string; short: string }[] = [
  { code: "km", label: "ភាសាខ្មែរ", short: "ខ្មែរ" },
  { code: "en", label: "English", short: "EN" },
]
export const DEFAULT_LOCALE: Locale = "km"
export const LOCALE_COOKIE = "pd_lang"

/** Looks a key up and fills {placeholders}. An unknown key shows itself, so nothing ever renders blank. */
export function translate(dict: Dict, key: string, vars?: Vars): string {
  let s = dict[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

export type TFn = (key: string, vars?: Vars) => string

/** Translate a value that comes from the database by its code (statuses, contract types, roles...).
 *  If there is no translation for that code, the name stored in the database is shown as it is. */
export function labelFor(t: TFn, prefix: string, code: string, fallback: string): string {
  const key = `${prefix}.${code}`
  const v = t(key)
  return v === key ? fallback : v
}
