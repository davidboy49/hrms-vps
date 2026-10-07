import { z } from "zod"

/** Staff sign in with this. Lowercase letters, digits, dot, dash and underscore, 3 to 32 characters. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, "err.usernameInvalid")

/** A starting suggestion from an employee number such as "EMP-0042" → "emp-0042". */
export const suggestUsername = (employeeNo: string) => employeeNo.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "")
