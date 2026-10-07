import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { toDate } from "@/lib/format"

export type SP = Record<string, string | string[] | undefined>

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""
const many = (v: string | string[] | undefined) =>
  one(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

export type Filters = {
  q: string
  dept: string[]
  desig: string[]
  contract: string[]
  status: string[]
  joinFrom: string
  joinTo: string
  rateMin: string
  rateMax: string
}

export function parseFilters(sp: SP): Filters {
  return {
    q: one(sp.q).trim(),
    dept: many(sp.dept),
    desig: many(sp.desig),
    contract: many(sp.contract),
    status: many(sp.status),
    joinFrom: one(sp.joinFrom),
    joinTo: one(sp.joinTo),
    rateMin: one(sp.rateMin),
    rateMax: one(sp.rateMax),
  }
}

export function buildWhere(f: Filters, ids?: string[]): Prisma.EmployeeWhereInput {
  const and: Prisma.EmployeeWhereInput[] = [{ deletedAt: null }]
  if (ids?.length) and.push({ id: { in: ids } })
  if (f.q)
    and.push({
      OR: [
        { nameEn: { contains: f.q, mode: "insensitive" } },
        { nameKm: { contains: f.q } },
        { employeeNo: { contains: f.q, mode: "insensitive" } },
        { phone: { contains: f.q } },
        { email: { contains: f.q, mode: "insensitive" } },
      ],
    })
  if (f.dept.length) and.push({ departmentId: { in: f.dept } })
  if (f.desig.length) and.push({ designationId: { in: f.desig } })
  if (f.contract.length) and.push({ contractTypeId: { in: f.contract } })
  if (f.status.length) and.push({ statusId: { in: f.status } })
  const from = toDate(f.joinFrom)
  const to = toDate(f.joinTo)
  if (from || to) and.push({ joiningDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } })
  const rmin = f.rateMin !== "" ? Number(f.rateMin) : NaN
  const rmax = f.rateMax !== "" ? Number(f.rateMax) : NaN
  if (!Number.isNaN(rmin) || !Number.isNaN(rmax))
    and.push({ rateAmount: { ...(!Number.isNaN(rmin) ? { gte: rmin } : {}), ...(!Number.isNaN(rmax) ? { lte: rmax } : {}) } })
  return { AND: and }
}

export const SORTS = ["employeeNo", "nameEn", "designation", "department", "joiningDate", "contract", "rateAmount", "status"] as const
export type SortKey = (typeof SORTS)[number]

export function buildOrderBy(sort: string, dir: string): Prisma.EmployeeOrderByWithRelationInput[] {
  const d = dir === "desc" ? "desc" : "asc"
  switch (sort) {
    case "nameEn": return [{ nameEn: d }]
    case "designation": return [{ designation: { name: d } }]
    case "department": return [{ department: { name: d } }]
    case "joiningDate": return [{ joiningDate: d }]
    case "contract": return [{ contractType: { name: d } }]
    case "rateAmount": return [{ rateAmount: d }]
    case "status": return [{ status: { name: d } }]
    default: return [{ employeeNo: d }]
  }
}

export const employeeInclude = {
  department: true,
  designation: true,
  contractType: true,
  status: true,
} satisfies Prisma.EmployeeInclude

export async function nextEmployeeNo() {
  const prefix = (await db.setting.findUnique({ where: { key: "employee.prefix" } }))?.value ?? "EMP-"
  const last = await db.employee.findMany({
    where: { employeeNo: { startsWith: prefix } },
    select: { employeeNo: true },
    orderBy: { employeeNo: "desc" },
    take: 1,
  })
  const n = last[0] ? parseInt(last[0].employeeNo.slice(prefix.length), 10) || 0 : 0
  return `${prefix}${String(n + 1).padStart(4, "0")}`
}

export async function lookups() {
  const [departments, designations, contractTypes, statuses, locations, shifts, scheduleTemplates] = await Promise.all([
    db.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.designation.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.contractType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.employeeStatus.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.shift.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.scheduleTemplate.findMany({ where: { isActive: true, isPersonal: false }, orderBy: { name: "asc" } }),
  ])
  return { departments, designations, contractTypes, statuses, locations, shifts, scheduleTemplates }
}
export type Lookups = Awaited<ReturnType<typeof lookups>>
