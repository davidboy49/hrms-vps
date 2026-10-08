import { redirect } from "next/navigation"
import QRCode from "qrcode"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { readPending } from "@/lib/twofactor"
import { decryptSecret, encryptSecret } from "@/lib/crypto-secret"
import { newSecret, otpauthUri } from "@/lib/totp"
import { getBranding } from "@/lib/branding"
import { getT } from "@/i18n/server"
import { LanguageSwitcher } from "@/components/language-switcher"
import { TwoFactorForm } from "./twofa-form"

export const dynamic = "force-dynamic"

export async function generateMetadata() {
  return { title: (await getT())("tfa.title") }
}

export default async function TwoFactorPage() {
  if (await getSession()) redirect("/")
  const pending = await readPending()
  if (!pending) redirect("/login")
  const user = await db.user.findUnique({ where: { id: pending.uid } })
  if (!user || !user.isActive || !user.totpRequired) redirect("/login")

  const enrolled = user.totpEnabledAt !== null
  let setup: { qr: string; secret: string } | null = null
  if (!enrolled) {
    // first time: make a secret and keep it (encrypted) until the first code proves the phone has it
    let secret = user.totpSecret ? decryptSecret(user.totpSecret) : null
    if (!secret) {
      secret = newSecret()
      await db.user.update({ where: { id: user.id }, data: { totpSecret: encryptSecret(secret) } })
    }
    const brand = await getBranding()
    setup = { secret, qr: await QRCode.toDataURL(otpauthUri(secret, user.username, brand.company), { margin: 1, width: 220 }) }
  } else if (!user.totpSecret) {
    redirect("/login")
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center p-6">
      <LanguageSwitcher className="absolute right-4 top-4" />
      <div className="w-full max-w-sm space-y-6">
        <TwoFactorForm setup={setup} name={user.name} />
      </div>
    </main>
  )
}
