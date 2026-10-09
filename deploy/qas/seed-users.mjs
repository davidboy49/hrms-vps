// Demo accounts for QAS. Safe to run again. Run by deploy/qas/update-qas.sh --seed, inside the app container.
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcrypt"

const db = new PrismaClient()
const password = process.env.QAS_DEMO_PASSWORD
if (!password || password.length < 12) throw new Error("QAS_DEMO_PASSWORD must be set (at least 12 characters)")
const hash = await bcrypt.hash(password, 12)

// the head office gets map coordinates, so QR check-in with a location can be tried
await db.location.updateMany({ where: { code: "HQ", latitude: null }, data: { latitude: 11.5564, longitude: 104.9282, radiusM: 200 } })

const staff = await db.employee.findFirst({ where: { deletedAt: null, status: { countsAsActive: true } }, orderBy: { employeeNo: "asc" } })
const demo = [
  { username: "hr.demo", name: "Demo HR", role: "HR", employeeId: null },
  { username: "manager.demo", name: "Demo Manager", role: "MANAGER", employeeId: null },
  { username: "staff.demo", name: staff?.nameEn ?? "Demo Staff", role: "EMPLOYEE", employeeId: staff?.id ?? null },
]
for (const d of demo) {
  const role = await db.appRole.findFirstOrThrow({ where: { key: d.role } })
  await db.user.upsert({
    where: { username: d.username },
    update: { passwordHash: hash, isActive: true, mustChangePassword: false },
    create: { username: d.username, name: d.name, roleId: role.id, employeeId: d.employeeId, passwordHash: hash },
  })
}
console.log("demo accounts ready:", demo.map((d) => d.username).join(", "))
await db.$disconnect()
