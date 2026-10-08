/* eslint-disable @typescript-eslint/no-explicit-any -- seed helper takes any Prisma model delegate */
import { PrismaClient, RateBasis } from "@prisma/client"
import bcrypt from "bcrypt"

const db = new PrismaClient()

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@company.com"
const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME ?? "admin"
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!"
const SAMPLE = process.env.SEED_SAMPLE !== "0"

async function lookup<T extends { code: string }>(
  model: { upsert: (a: any) => Promise<any> },
  rows: (T & Record<string, unknown>)[],
) {
  const out: Record<string, any> = {}
  for (const r of rows) {
    out[r.code] = await model.upsert({ where: { code: r.code }, update: {}, create: r })
  }
  return out
}

async function main() {
  await db.user.upsert({
    where: { username: ADMIN_USERNAME },
    update: {},
    create: { username: ADMIN_USERNAME, email: ADMIN_EMAIL, name: "System Admin", role: { connect: { key: "ADMIN" } }, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10) },
  })

  const depts = await lookup(db.department, [
    { code: "OPS", name: "Operations" },
    { code: "FIN", name: "Finance" },
    { code: "HR", name: "Human Resources" },
    { code: "IT", name: "IT" },
    { code: "SAL", name: "Sales" },
  ])
  const desig = await lookup(db.designation, [
    { code: "MGR", name: "Operations Manager", departmentId: depts.OPS.id },
    { code: "SUP", name: "Site Supervisor", departmentId: depts.OPS.id },
    { code: "DRV", name: "Driver", departmentId: depts.OPS.id },
    { code: "ACC", name: "Senior Accountant", departmentId: depts.FIN.id },
    { code: "PAY", name: "Payroll Officer", departmentId: depts.FIN.id },
    { code: "HRO", name: "HR Officer", departmentId: depts.HR.id },
    { code: "DEV", name: "Software Developer", departmentId: depts.IT.id },
    { code: "SAE", name: "Sales Executive", departmentId: depts.SAL.id },
  ])
  const ctypes = await lookup(db.contractType, [
    { code: "UDC", name: "Unlimited", requiresEndDate: false, defaultRateBasis: "MONTH" },
    { code: "FDC", name: "Fixed term", requiresEndDate: true, defaultRateBasis: "MONTH" },
    { code: "DLY", name: "Daily rate", requiresEndDate: false, defaultRateBasis: "DAY" },
    { code: "PRB", name: "Probation", requiresEndDate: true, defaultRateBasis: "MONTH" },
  ])
  const statuses = await lookup(db.employeeStatus, [
    { code: "ACTIVE", name: "Active", color: "green", countsAsActive: true },
    { code: "PROBATION", name: "Probation", color: "amber", countsAsActive: true },
    { code: "LEAVE", name: "On leave", color: "blue", countsAsActive: true },
    { code: "RESIGNED", name: "Resigned", color: "gray", countsAsActive: false },
    { code: "TERMINATED", name: "Terminated", color: "red", countsAsActive: false },
  ])
  const locs = await lookup(db.location, [
    { code: "HQ", name: "Head office", address: "Phnom Penh" },
    { code: "WH", name: "Warehouse", address: "Phnom Penh" },
  ])
  const shifts = await lookup(db.shift, [
    { code: "DAY", name: "Day shift", startTime: "08:00", endTime: "17:00", graceMin: 10 },
    { code: "EARLY", name: "Early shift", startTime: "06:00", endTime: "15:00", graceMin: 10 },
  ])
  await lookup(db.holiday, [
    { code: "NY2027", name: "International New Year", date: new Date("2027-01-01T00:00:00Z") },
    { code: "KNY2027", name: "Khmer New Year", date: new Date("2027-04-14T00:00:00Z") },
    { code: "LAB2027", name: "Labour Day", date: new Date("2027-05-01T00:00:00Z") },
  ])

  await db.setting.upsert({ where: { key: "company.name" }, update: {}, create: { key: "company.name", value: "Your Company Co., Ltd." } })
  await db.setting.upsert({ where: { key: "employee.prefix" }, update: {}, create: { key: "employee.prefix", value: "EMP-" } })
  await db.setting.upsert({ where: { key: "attendance.lateGraceMin" }, update: {}, create: { key: "attendance.lateGraceMin", value: "10" } })

  const hq = await db.device.findFirst({ where: { name: "Head office – Main door" } })
  if (!hq) {
    await db.device.create({ data: { name: "Head office – Main door", model: "ZKTeco SpeedFace-V5L", ip: "192.168.1.201", mode: "MOCK", status: "ONLINE", locationId: locs.HQ.id } })
    await db.device.create({ data: { name: "Warehouse – Gate", model: "ZKTeco K40", ip: "192.168.2.15", mode: "MOCK", status: "ONLINE", locationId: locs.WH.id } })
  }

  if (SAMPLE && (await db.employee.count()) === 0) {
    const names = [
      "Sophea Chan","Vanna Kem","Rithy Pov","Malis Nuon","Dara Sok","Srey Leak","Bopha Heng","Sokha Lim","Chenda Mao","Vibol Sam",
      "Kunthea Roth","Piseth Yim","Sreyneang Ouk","Makara Tep","Channary Khun","Sovann Ly","Davy Chea","Rathana Ek","Sreypov Nhem","Visal Prak",
      "Kosal Meas","Navy Seng","Samnang Keo","Phalla Hun","Sophal Duong","Rotha Pen","Srey Mom Kong","Borey Chhun","Lina Soy","Narith Vong",
      "Chhay Leng","Pheakdey Sorn","Kanha Tith","Reaksmey Bun","Thida Ros","Veasna Koy","Monika Sao","Chantha Pich","Sarun Yong","Puthea Nget",
    ]
    const dList = Object.values(depts), dsList = Object.values(desig), cList = Object.values(ctypes)
    const sActive = statuses.ACTIVE
    for (let i = 0; i < names.length; i++) {
      const dsg = dsList[i % dsList.length]
      const ct = cList[i % cList.length]
      const basis: RateBasis = ct.code === "DLY" ? "DAY" : "MONTH"
      const joined = new Date(Date.UTC(2018 + (i % 8), (i * 5) % 12, 1 + ((i * 7) % 27)))
      const status = i % 11 === 4 ? statuses.LEAVE : i % 9 === 2 ? statuses.PROBATION : i % 17 === 16 ? statuses.RESIGNED : sActive
      await db.employee.create({
        data: {
          employeeNo: `EMP-${String(i + 1).padStart(4, "0")}`,
          nameEn: names[i],
          gender: i % 2 ? "FEMALE" : "MALE",
          phone: `+855 12 ${String(300000 + i * 137).padStart(6, "0")}`.replace(/(\d{3})(\d{3})$/, "$1 $2"),
          departmentId: dsg.departmentId ?? dList[i % dList.length].id,
          designationId: dsg.id,
          contractTypeId: ct.id,
          statusId: status.id,
          locationId: i % 3 === 0 ? locs.WH.id : locs.HQ.id,
          shiftId: shifts.DAY.id,
          joiningDate: joined,
          contractEnd: ct.requiresEndDate ? new Date(Date.UTC(2026, 10 + (i % 6), 28)) : null,
          rateAmount: basis === "DAY" ? 12 + (i % 6) : 450 + ((i * 53) % 1400),
          rateBasis: basis,
          currency: "USD",
          zkPin: String(1001 + i),
        },
      })
    }
  }
  console.log(`Seed complete. Admin: ${ADMIN_EMAIL}${process.env.SEED_ADMIN_PASSWORD ? "" : " / " + ADMIN_PASSWORD}`)
}

main().finally(() => db.$disconnect())
