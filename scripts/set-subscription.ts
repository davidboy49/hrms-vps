// Usage: npm run sub:set -- 2027-10-06     (last day of service)
//        npm run sub:set -- clear          (remove the date, no banner)
//        npm run sub:set                   (show the current date)
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()
const KEY = "subscription.endsAt"
const arg = process.argv[2]

if (!arg) {
  const row = await db.setting.findUnique({ where: { key: KEY } })
  console.log(row ? `Subscription ends: ${row.value}` : "No subscription date set.")
} else if (arg === "clear") {
  await db.setting.deleteMany({ where: { key: KEY } })
  console.log("Subscription date removed.")
} else if (/^\d{4}-\d{2}-\d{2}$/.test(arg) && !Number.isNaN(Date.parse(arg))) {
  await db.setting.upsert({ where: { key: KEY }, update: { value: arg }, create: { key: KEY, value: arg } })
  console.log(`Subscription ends: ${arg}`)
} else {
  console.error("Give a date as YYYY-MM-DD, or 'clear'.")
  process.exitCode = 1
}
await db.$disconnect()
