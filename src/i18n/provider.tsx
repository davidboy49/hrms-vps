"use client"

import { createContext, useContext, useMemo } from "react"
import { translate, type Dict, type Locale, type TFn, type Vars } from "./core"
import { dictFor } from "./dict"

const Ctx = createContext<{ locale: Locale; dict: Dict }>({ locale: "km", dict: {} })

// The translations are not passed in: they come from the same module on the server and in the browser (one cached script file).
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, dict: dictFor(locale) }), [locale])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useT(): TFn {
  const { dict } = useContext(Ctx)
  return (key: string, vars?: Vars) => translate(dict, key, vars)
}

export const useLocale = () => useContext(Ctx).locale
