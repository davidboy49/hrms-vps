import type { Dict, Locale } from "./core"
import { en } from "./en"
import { km } from "./km"

// Built ONCE, when the module loads. Khmer first, with English filling any gap so a missing translation never shows a raw key.
// The server and the browser both use this same function: the browser gets the translations as one cached script file,
// not inside every page it opens (that was 50 to 100 KB on every page).
const KM_WITH_FALLBACK: Dict = { ...en, ...km }

export const dictFor = (locale: Locale): Dict => (locale === "en" ? en : KM_WITH_FALLBACK)
