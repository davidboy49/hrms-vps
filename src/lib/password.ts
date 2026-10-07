import { z } from "zod"

const COMMON = new Set([
  "password", "password1", "password123", "passw0rd", "123456789", "1234567890", "12345678910", "qwertyuiop", "qwerty12345",
  "iloveyou123", "admin12345", "administrator", "changeme123", "changeme123!", "welcome123", "letmein123", "abc1234567", "11111111111",
])

/** One rule for every place a password is set: at least 10 characters, not trivially guessable. */
export const passwordSchema = z
  .string()
  .min(10, "pw.min")
  .max(128, "pw.max")
  .refine((p) => !COMMON.has(p.toLowerCase()), "pw.common")
  .refine((p) => new Set(p).size >= 5, "pw.mix")

export const BCRYPT_COST = 12
