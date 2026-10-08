import { db } from "@/lib/db"
import { requirePerm } from "@/lib/session"
import { lookups, nextEmployeeNo } from "@/lib/employees"
import { PageHeader } from "@/components/page-header"
import { getT, titleOf } from "@/i18n/server"
import { EmployeeForm, type FormValues } from "../employee-form"

export const generateMetadata = titleOf("emp.add")
export const dynamic = "force-dynamic"

export default async function NewEmployeePage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const t = await getT()
  await requirePerm("employees.edit")
  const { from } = await searchParams
  const [lk, no, cur] = await Promise.all([lookups(), nextEmployeeNo(), db.setting.findUnique({ where: { key: "company.currency" } })])
  const active = lk.statuses.find((s) => s.code === "ACTIVE") ?? lk.statuses[0]
  const values: FormValues = {
    employeeNo: no, nameEn: "", nameKm: "", gender: "", dob: "", phone: "", email: "", nationalId: "", address: "",
    departmentId: "", designationId: "", contractTypeId: "", statusId: active?.id ?? "", locationId: "", shiftId: "", scheduleTemplateId: "",
    joiningDate: new Date().toISOString().slice(0, 10), contractEnd: "", leavingDate: "", rateAmount: "", rateBasis: "MONTH", currency: cur?.value ?? "USD", zkPin: "", photoUrl: null,
  }
  // "Copy" from an existing employee: job, contract, location and pay carry over; the person's own details and unique IDs do not
  const src = typeof from === "string" && from ? await db.employee.findFirst({ where: { id: from, deletedAt: null }, include: { scheduleTemplate: { select: { isPersonal: true } } } }) : null
  if (src) {
    Object.assign(values, {
      departmentId: src.departmentId, designationId: src.designationId, contractTypeId: src.contractTypeId, statusId: src.statusId,
      locationId: src.locationId ?? "", shiftId: src.shiftId ?? "",
      // a weekly pattern set for one person stays with that person
      scheduleTemplateId: src.scheduleTemplateId && !src.scheduleTemplate?.isPersonal ? src.scheduleTemplateId : "",
      rateAmount: String(src.rateAmount), rateBasis: src.rateBasis, currency: src.currency,
    })
  }
  return (
    <>
      <PageHeader title={t("emp.add")} description={src ? t("emp.copyDesc", { name: src.nameEn }) : t("emp.addDesc")} />
      <EmployeeForm id={null} values={values} lookups={lk} />
    </>
  )
}
