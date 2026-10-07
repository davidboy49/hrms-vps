import { cookies } from "next/headers"
import { DEFAULT_LOCALE, LOCALE_COOKIE, translate, type Dict, type Locale, type TFn, type Vars } from "./core"
import { en } from "./en"
import { km } from "./km"

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value
  return v === "en" || v === "km" ? v : DEFAULT_LOCALE
}

/** Khmer first, with English filling any gap so a missing translation never shows a raw key. */
export function dictFor(locale: Locale): Dict {
  return locale === "en" ? en : { ...en, ...km }
}

export async function getT(): Promise<TFn> {
  const dict = dictFor(await getLocale())
  return (key: string, vars?: Vars) => translate(dict, key, vars)
}

/** For pages: `export const generateMetadata = titleOf("nav.dashboard")` gives a title in the viewer's language. */
export const titleOf = (key: string) => async () => ({ title: (await getT())(key) })
