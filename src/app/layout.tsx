import type { Metadata } from "next"
import { Geist, Geist_Mono, Noto_Sans_Khmer } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { I18nProvider } from "@/i18n/provider"
import { dictFor, getLocale } from "@/i18n/server"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })
// Geist has no Khmer glyphs, so Khmer text falls through to this face
const khmer = Noto_Sans_Khmer({ variable: "--font-khmer", subsets: ["khmer"], display: "swap" })

export const metadata: Metadata = {
  title: { default: "PeopleDesk", template: "%s · PeopleDesk" },
  description: "HR management: employees, attendance and masterdata",
  robots: { index: false, follow: false },
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale()
  return (
    <html lang={locale} suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${khmer.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <I18nProvider locale={locale} dict={dictFor(locale)}>
            {children}
            <Toaster richColors position="top-right" />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
