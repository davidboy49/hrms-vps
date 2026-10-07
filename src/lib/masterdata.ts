export type FieldDef = {
  name: string
  label: string
  type: "text" | "bool" | "date" | "time" | "number" | "decimal" | "select" | "relation"
  required?: boolean
  options?: { value: string; label: string }[]
  /** for relation fields: which entity supplies the options */
  of?: EntityKey
  /** show as a column in the table */
  column?: boolean
}

export type EntityKey = "departments" | "designations" | "contract-types" | "statuses" | "locations" | "shifts" | "holidays"

export type EntityDef = {
  key: EntityKey
  label: string
  singular: string
  model: "department" | "designation" | "contractType" | "employeeStatus" | "location" | "shift" | "holiday"
  hasEmployees: boolean
  fields: FieldDef[]
}

const BASIS = [
  { value: "MONTH", label: "basis.MONTH" },
  { value: "DAY", label: "basis.DAY" },
  { value: "HOUR", label: "basis.HOUR" },
]
const SHIFT_COLOUR_OPTIONS = ["blue", "teal", "green", "lime", "amber", "orange", "rose", "purple", "slate"].map((c) => ({ value: c, label: `color.${c}` }))
const QR_MODES = [
  { value: "STATIC", label: "qrmode.STATIC" },
  { value: "ROTATING", label: "qrmode.ROTATING" },
]
const COLORS = ["green", "amber", "blue", "red", "gray"].map((c) => ({ value: c, label: `color.${c}` }))

export const ENTITIES: EntityDef[] = [
  {
    key: "departments", label: "md.departments", singular: "md.departments.one", model: "department", hasEmployees: true,
    fields: [
      { name: "code", label: "mdf.code", type: "text", required: true, column: true },
      { name: "name", label: "mdf.name", type: "text", required: true, column: true },
      { name: "parentId", label: "mdf.parentId", type: "relation", of: "departments", column: true },
    ],
  },
  {
    key: "designations", label: "md.designations", singular: "md.designations.one", model: "designation", hasEmployees: true,
    fields: [
      { name: "code", label: "mdf.code", type: "text", required: true, column: true },
      { name: "name", label: "mdf.name", type: "text", required: true, column: true },
      { name: "departmentId", label: "mdf.departmentId", type: "relation", of: "departments", column: true },
    ],
  },
  {
    key: "contract-types", label: "md.contract-types", singular: "md.contract-types.one", model: "contractType", hasEmployees: true,
    fields: [
      { name: "code", label: "mdf.code", type: "text", required: true, column: true },
      { name: "name", label: "mdf.name", type: "text", required: true, column: true },
      { name: "requiresEndDate", label: "mdf.requiresEndDate", type: "bool", column: true },
      { name: "defaultRateBasis", label: "mdf.defaultRateBasis", type: "select", options: BASIS, required: true, column: true },
    ],
  },
  {
    key: "statuses", label: "md.statuses", singular: "md.statuses.one", model: "employeeStatus", hasEmployees: true,
    fields: [
      { name: "code", label: "mdf.code", type: "text", required: true, column: true },
      { name: "name", label: "mdf.name", type: "text", required: true, column: true },
      { name: "color", label: "mdf.color", type: "select", options: COLORS, required: true, column: true },
      { name: "countsAsActive", label: "mdf.countsAsActive", type: "bool", column: true },
    ],
  },
  {
    key: "locations", label: "md.locations", singular: "md.locations.one", model: "location", hasEmployees: true,
    fields: [
      { name: "code", label: "mdf.code", type: "text", required: true, column: true },
      { name: "name", label: "mdf.name", type: "text", required: true, column: true },
      { name: "address", label: "mdf.address", type: "text", column: true },
      { name: "latitude", label: "mdf.latitude", type: "decimal" },
      { name: "longitude", label: "mdf.longitude", type: "decimal" },
      { name: "radiusM", label: "mdf.radiusM", type: "number", required: true },
      { name: "qrMode", label: "mdf.qrMode", type: "select", options: QR_MODES, required: true, column: true },
    ],
  },
  {
    key: "shifts", label: "md.shifts", singular: "md.shifts.one", model: "shift", hasEmployees: true,
    fields: [
      { name: "code", label: "mdf.code", type: "text", required: true, column: true },
      { name: "name", label: "mdf.name", type: "text", required: true, column: true },
      { name: "startTime", label: "mdf.startTime", type: "time", required: true, column: true },
      { name: "endTime", label: "mdf.endTime", type: "time", required: true, column: true },
      { name: "graceMin", label: "mdf.graceMin", type: "number", required: true, column: true },
      { name: "colour", label: "mdf.colour", type: "select", options: SHIFT_COLOUR_OPTIONS, required: true, column: true },
    ],
  },
  {
    key: "holidays", label: "md.holidays", singular: "md.holidays.one", model: "holiday", hasEmployees: false,
    fields: [
      { name: "code", label: "mdf.code", type: "text", required: true, column: true },
      { name: "name", label: "mdf.name", type: "text", required: true, column: true },
      { name: "date", label: "mdf.date", type: "date", required: true, column: true },
    ],
  },
]

export const entityByKey = (k: string) => ENTITIES.find((e) => e.key === k)
