import ExcelJS from "exceljs"
import { db } from "@/lib/db"
import { localDateKey, localMinutes } from "@/lib/format"
import { buildPunchWhere, parsePunchFilters } from "@/lib/punches"
import type { SP } from "@/lib/employees"
import { loadPlanner } from "@/lib/schedule"

/** Same layout as the "Attendance Logs" sheet the company already uses: one row per employee per day. */
export const LOG_HEADERS = ["No", "Date", "Code", "Name", "Site", "Department", "Designation", "Shift", "Schedule", "Total Hour", "In", "Out", "Clocked Hour", "Remark"]

export type LogRow = (string | number)[]

const MAX_ROWS = 50_000
const MAX_RANGE_DAYS = 93

const ddmmyyyy = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`
const clock = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h % 12 === 0 ? 12 : h % 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
}
const hhmmToMin = (s: string) => {
  const [h, m] = s.split(":").map(Number)
  return h * 60 + m
}
const round2 = (n: number) => Math.round(n * 100) / 100

export async function buildLogRows(sp: SP): Promise<{ rows: LogRow[]; company: string; truncated: boolean }> {
  const f = parsePunchFilters(sp)
  const settings = Object.fromEntries((await db.setting.findMany({ where: { key: { in: ["company.name", "log.lateAfterMin", "log.earlyBeforeMin"] } } })).map((s) => [s.key, s.value]))
  const company = settings["company.name"] || "Attendance"
  const lateAfter = Number(settings["log.lateAfterMin"] ?? 30)
  const earlyBefore = Number(settings["log.earlyBeforeMin"] ?? 30)

  // matched punches only: the log is per employee
  const where = { AND: [buildPunchWhere(f), { employeeId: { not: null } }] }
  const punches = await db.attendancePunch.findMany({
    where,
    orderBy: { punchedAt: "asc" },
    take: 200_000,
    select: { employeeId: true, punchedAt: true },
  })

  type Day = { first: Date; last: Date; n: number }
  const byDay = new Map<string, Day>() // employeeId|yyyy-mm-dd
  for (const p of punches) {
    const k = `${p.employeeId}|${localDateKey(p.punchedAt)}`
    const d = byDay.get(k)
    if (!d) byDay.set(k, { first: p.punchedAt, last: p.punchedAt, n: 1 })
    else {
      d.last = p.punchedAt
      d.n++
    }
  }

  // with a date range and no device/type/match filter, working days without any punch are listed too
  const wantAbsent = Boolean(f.from && f.to) && !f.device.length && !f.type && !f.match
  const today = localDateKey(new Date())
  const days: string[] = []
  if (wantAbsent) {
    const start = new Date(f.from + "T00:00:00Z")
    const end = new Date(Math.min(new Date(f.to + "T00:00:00Z").getTime(), new Date(today + "T00:00:00Z").getTime()))
    for (let d = start; d <= end && days.length <= MAX_RANGE_DAYS; d = new Date(d.getTime() + 86400_000)) days.push(d.toISOString().slice(0, 10))
  }

  const empIds = new Set<string>([...byDay.keys()].map((k) => k.split("|")[0]))
  const empWhere = wantAbsent
    ? {
        deletedAt: null,
        OR: [{ id: { in: [...empIds] } }, { status: { countsAsActive: true } }],
        ...(f.dept.length ? { departmentId: { in: f.dept } } : {}),
        ...(f.q ? { AND: [{ OR: [{ nameEn: { contains: f.q, mode: "insensitive" as const } }, { employeeNo: { contains: f.q, mode: "insensitive" as const } }] }] } : {}),
      }
    : { id: { in: [...empIds] } }
  const emps = await db.employee.findMany({
    where: empWhere,
    orderBy: { employeeNo: "asc" },
    include: { department: true, designation: true, location: true, shift: true },
  })

  // each person's plan per day: their weekly template, holidays and one-day roster changes
  const punchKeys = [...byDay.keys()].map((k) => k.split("|")[1]).sort()
  const allKeys = [...days, ...punchKeys].sort()
  const plan = allKeys.length ? await loadPlanner(emps.map((e) => e.id), allKeys[0], allKeys[allKeys.length - 1]) : null

  const rows: LogRow[] = []
  let truncated = false
  outer: for (const e of emps) {
    const keys = new Set<string>([...byDay.keys()].filter((k) => k.startsWith(e.id + "|")).map((k) => k.split("|")[1]))
    if (wantAbsent && plan) {
      const joined = e.joiningDate.toISOString().slice(0, 10)
      // only days the person was meant to work (or was on leave) appear when there is no punch
      for (const d of days) {
        const k = plan(e.id, d).kind
        if (d >= joined && (k === "WORK" || k === "LEAVE")) keys.add(d)
      }
    }
    for (const date of [...keys].sort()) {
      const dp = plan ? plan(e.id, date) : null
      const shift = dp?.shift ?? e.shift
      const sStart = shift ? hhmmToMin(shift.startTime) : null
      const sEnd = shift ? hhmmToMin(shift.endTime) : null
      if (rows.length >= MAX_ROWS) {
        truncated = true
        break outer
      }
      const d = byDay.get(`${e.id}|${date}`)
      const remarks: string[] = []
      let inT = "N/A"
      let outT = "N/A"
      let hours = 0
      if (!d) {
        remarks.push(dp?.kind === "LEAVE" ? "On leave" : "Error: No clock in and clock out")
      } else {
        inT = clock(localMinutes(d.first))
        if (d.n > 1) {
          outT = clock(localMinutes(d.last))
          hours = round2((d.last.getTime() - d.first.getTime()) / 3600_000)
        } else {
          remarks.push("Error: No clock in or clock out")
        }
        if (dp?.kind === "OFF") remarks.push("Worked on day off")
        if (dp?.kind === "HOLIDAY") remarks.push("Worked on public holiday")
        if (dp?.kind === "LEAVE") remarks.push("Clocked during leave")
        if (dp?.kind === "WORK" && sStart !== null && sEnd !== null) {
          const lateBy = localMinutes(d.first) - sStart
          if (lateBy > lateAfter) remarks.push(`LI: ${lateBy} min`)
          if (d.n > 1) {
            const earlyBy = sEnd - localMinutes(d.last)
            if (earlyBy > earlyBefore) remarks.push(`LE: ${earlyBy} min`)
          }
        }
      }
      rows.push([
        rows.length + 1,
        ddmmyyyy(date),
        e.employeeNo,
        e.nameEn,
        e.location?.name ?? "",
        e.department.name,
        e.designation.name,
        dp && dp.kind !== "WORK" ? (dp.kind === "OFF" ? "Day off" : dp.kind === "HOLIDAY" ? "Public holiday" : "Leave") : (shift?.name ?? ""),
        dp && dp.kind !== "WORK" ? "" : sStart !== null && sEnd !== null ? `${clock(sStart)} - ${clock(sEnd)}` : "",
        dp && dp.kind !== "WORK" ? 0 : sStart !== null && sEnd !== null ? round2((sEnd - sStart) / 60) : 0,
        inT,
        outT,
        hours,
        remarks.join(", "),
      ])
    }
  }
  return { rows, company, truncated }
}

const BORDER_THIN: Partial<ExcelJS.Borders> = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } }
const BORDER_DOUBLE: Partial<ExcelJS.Borders> = { top: { style: "double" }, left: { style: "double" }, bottom: { style: "double" }, right: { style: "double" } }

export async function buildLogWorkbook(company: string, rows: LogRow[]) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Attendance Logs")
  const widths = [6, 12, 10, 24, 12, 16, 20, 22, 22, 11, 11, 11, 13, 34]
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w))

  ws.mergeCells("A1:N1")
  ws.getCell("A1").value = company
  ws.getCell("A1").font = { bold: true, size: 16, name: "Calibri" }
  ws.getCell("A1").alignment = { horizontal: "center" }
  ws.mergeCells("A2:N2")
  ws.getCell("A2").value = "Attendance Logs"
  ws.getCell("A2").font = { bold: true, size: 14, name: "Calibri" }
  ws.getCell("A2").alignment = { horizontal: "center" }

  const top: [string, string, string][] = [
    ["A4:A5", "A4", "No"],
    ["B4:B5", "B4", "Date"],
    ["C4:D4", "C4", "Employee"],
    ["E4:E5", "E4", "Site"],
    ["F4:F5", "F4", "Department"],
    ["G4:G5", "G4", "Designation"],
    ["H4:J4", "H4", "Working Schedule"],
    ["K4:L4", "K4", "Time Table 1"],
    ["M4:M5", "M4", "Clocked Hour"],
    ["N4:N5", "N4", "Remark"],
  ]
  for (const [range, cell, label] of top) {
    ws.mergeCells(range)
    ws.getCell(cell).value = label
  }
  const second: Record<string, string> = { C5: "Code", D5: "Name", H5: "Shift", I5: "Schedule", J5: "Total Hour", K5: "In", L5: "Out" }
  for (const [c, v] of Object.entries(second)) ws.getCell(c).value = v
  for (let r = 4; r <= 5; r++)
    for (let c = 1; c <= 14; c++) {
      const cell = ws.getCell(r, c)
      cell.font = { bold: true, size: 11, name: "Calibri" }
      cell.alignment = { horizontal: "center", vertical: "middle" }
      cell.border = BORDER_DOUBLE
    }

  rows.forEach((r, i) => {
    const row = ws.getRow(6 + i)
    r.forEach((v, c) => {
      const cell = row.getCell(c + 1)
      cell.value = v
      cell.font = { size: 11, name: "Calibri" }
      cell.border = BORDER_THIN
    })
  })
  ws.views = [{ state: "frozen", ySplit: 5 }]
  return wb
}

