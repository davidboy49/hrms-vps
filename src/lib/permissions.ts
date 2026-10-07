/**
 * Every permission the app checks. A role is just a named set of these keys.
 * Add a new key here, use it with can()/assertPerm()/requirePerm(), and it shows up in Settings → Roles.
 * The built-in Admin role always has every key, so a new permission never locks the admin out.
 */
export const PERMISSION_GROUPS = [
  { group: "dashboard", perms: ["dashboard.view", "alerts.view"] },
  { group: "employees", perms: ["employees.view", "employees.edit", "employees.import", "employees.export"] },
  { group: "attendance", perms: ["attendance.view", "attendance.manage", "attendance.export", "attendance.devices"] },
  { group: "roster", perms: ["roster.view", "roster.edit", "qr.manage"] },
  { group: "leave", perms: ["leave.viewAll", "leave.manage", "overtime.viewAll", "overtime.manage"] },
  { group: "announcements", perms: ["announcements.manage"] },
  { group: "masterdata", perms: ["masterdata.view", "masterdata.edit", "masterdata.delete"] },
  { group: "settings", perms: ["settings.view", "settings.manage", "settings.notifications", "users.manage", "roles.manage", "audit.view"] },
] as const

export type Permission = (typeof PERMISSION_GROUPS)[number]["perms"][number]
export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) => [...g.perms])
const VALID = new Set<string>(ALL_PERMISSIONS)
export const isPermission = (p: string): p is Permission => VALID.has(p)

const MANAGER: Permission[] = ["dashboard.view", "alerts.view", "employees.view", "attendance.view", "roster.view", "leave.viewAll", "overtime.viewAll"]
const HR: Permission[] = [
  ...MANAGER,
  "employees.edit", "employees.import", "employees.export", "attendance.manage", "attendance.export", "roster.edit", "qr.manage",
  "leave.manage", "overtime.manage", "announcements.manage", "masterdata.view", "masterdata.edit", "settings.view",
]

/** The four roles every install starts with. Same access as the old fixed roles. */
export const BUILT_IN_ROLES: { key: string; name: string; description: string; perms: Permission[] }[] = [
  { key: "ADMIN", name: "Admin", description: "Full access", perms: ALL_PERMISSIONS },
  { key: "HR", name: "HR", description: "Manages employees, attendance, leave and settings", perms: HR },
  { key: "MANAGER", name: "Manager", description: "Views employees, attendance, leave and overtime", perms: MANAGER },
  { key: "EMPLOYEE", name: "Employee", description: "Own attendance, leave and overtime only", perms: [] },
]

export function can(user: { perms: readonly string[] }, perm: Permission) {
  return user.perms.includes(perm)
}
