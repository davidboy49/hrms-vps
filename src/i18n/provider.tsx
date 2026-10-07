"use client"

import { createContext, useContext, useMemo } from "react"
import { translate, type Dict, type Locale, type TFn, type Vars } from "./core"

const Ctx = createContext<{ locale: Locale; dict: Dict }>({ locale: "km", dict: {} })

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dict; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useT(): TFn {
  const { dict } = useContext(Ctx)
  return (key: string, vars?: Vars) => translate(dict, key, vars)
}

export const useLocale = () => useContext(Ctx).locale
