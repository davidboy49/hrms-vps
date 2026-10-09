import { cookies } from "next/headers"
import { DEFAULT_LOCALE, LOCALE_COOKIE, translate, type Locale, type TFn, type Vars } from "./core"
import { dictFor } from "./dict"

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value
  return v === "en" || v === "km" ? v : DEFAULT_LOCALE
}

export { dictFor }

export async function getT(force?: Locale): Promise<TFn> {
  const dict = dictFor(force ?? (await getLocale()))
  return (key: string, vars?: Vars) => translate(dict, key, vars)
}

/** For pages: `export const generateMetadata = titleOf("nav.dashboard")` gives a title in the viewer's language. */
export const titleOf = (key: string) => async () => ({ title: (await getT())(key) })
