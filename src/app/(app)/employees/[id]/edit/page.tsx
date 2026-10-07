import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { requirePerm } from "@/lib/session"
import { lookups } from "@/lib/employees"
import { toInput } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { getT, titleOf } from "@/i18n/server"
import { EmployeeForm, type FormValues } from "../../employee-form"

export const generateMetadata = titleOf("emp.edit")
export const dynamic = "force-dynamic"

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT()
  await requirePerm("employees.edit")
  const { id } = await params
  const [e, lk] = await Promise.all([db.employee.findFirst({ where: { id, deletedAt: null } }), lookups()])
  if (!e) notFound()
  // keep the current values selectable even if they were deactivated in masterdata
  const keep = async () => {
    const [d, ds, c, s] = await Promise.all([
      db.department.findUnique({ where: { id: e.departmentId } }),
      db.designation.findUnique({ where: { id: e.designationId } }),
      db.contractType.findUnique({ where: { id: e.contractTypeId } }),
      db.employeeStatus.findUnique({ where: { id: e.statusId } }),
    ])
    if (d && !lk.departments.some((x) => x.id === d.id)) lk.departments.push(d)
    if (ds && !lk.designations.some((x) => x.id === ds.id)) lk.designations.push(ds)
    if (c && !lk.contractTypes.some((x) => x.id === c.id)) lk.contractTypes.push(c)
    if (s && !lk.statuses.some((x) => x.id === s.id)) lk.statuses.push(s)
  }
  await keep()
  const tplPersonal = e.scheduleTemplateId ? Boolean((await db.scheduleTemplate.findUnique({ where: { id: e.scheduleTemplateId }, select: { isPersonal: true } }))?.isPersonal) : false
  const values: FormValues = {
    employeeNo: e.employeeNo, nameEn: e.nameEn, nameKm: e.nameKm ?? "", gender: e.gender ?? "", dob: toInput(e.dob), phone: e.phone ?? "",
    email: e.email ?? "", nationalId: e.nationalId ?? "", address: e.address ?? "", departmentId: e.departmentId, designationId: e.designationId,
    contractTypeId: e.contractTypeId, statusId: e.statusId, locationId: e.locationId ?? "", shiftId: e.shiftId ?? "", scheduleTemplateId: e.scheduleTemplateId && tplPersonal ? "__personal" : (e.scheduleTemplateId ?? ""), joiningDate: toInput(e.joiningDate),
    contractEnd: toInput(e.contractEnd), leavingDate: toInput(e.leavingDate), rateAmount: String(e.rateAmount), rateBasis: e.rateBasis, currency: e.currency, zkPin: e.zkPin ?? "", photoUrl: e.photoUrl,
  }
  return (
    <>
      <PageHeader title={t("emp.editName", { name: e.nameEn })} description={e.employeeNo} />
      <EmployeeForm id={e.id} values={values} lookups={lk} personalTemplate={tplPersonal} />
    </>
  )
}
