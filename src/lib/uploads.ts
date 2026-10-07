import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import fs from "node:fs/promises"
import path from "node:path"

export const MAX_PHOTO = 2 * 1024 * 1024
const OK = ["image/jpeg", "image/png", "image/webp"]

/** Private S3-compatible bucket (MinIO in compose.yaml). */
export const BUCKET = process.env.STORAGE_BUCKET ?? "uploads"

export const s3Configured = () => Boolean(process.env.AWS_ENDPOINT_URL_S3 && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)

let client: S3Client | null = null
function s3() {
  client ??= new S3Client({
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    region: process.env.AWS_REGION ?? "us-east-1",
    forcePathStyle: true, // the bucket name travels in the path
  })
  return client
}

/**
 * Stores a photo and returns the reference saved on the employee:
 *   "s3:<key>"     in the storage bucket (served by /api/photo, login required)
 *   "/uploads/..." on local disk (development only)
 */
/** The browser-supplied type can be faked, so look at the first bytes of the file itself. */
function sniffImage(b: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg"
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png"
  if (b.length > 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp"
  return null
}

export async function savePhoto(file: File, name: string, folder: "employees" | "branding" = "employees"): Promise<string> {
  if (!OK.includes(file.type)) throw new Error("upload.err.type")
  if (file.size > MAX_PHOTO) throw new Error("form.photoSize")
  const body = Buffer.from(await file.arrayBuffer())
  const real = sniffImage(body)
  if (!real) throw new Error("upload.err.invalid")
  const ext = real === "image/png" ? "png" : real === "image/webp" ? "webp" : "jpg"
  const file_name = `${name}-${Date.now()}.${ext}`

  if (s3Configured()) {
    const key = `${folder}/${file_name}`
    await s3().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: real }))
    return `s3:${key}`
  }
  // files on local disk are public, so production must use the private bucket
  if (process.env.NODE_ENV === "production") throw new Error("upload.err.config")
  const dir = path.join(process.cwd(), "public", "uploads")
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, file_name), body)
  return `/uploads/${file_name}`
}

export async function removePhoto(ref: string | null | undefined) {
  if (!ref) return
  try {
    if (ref.startsWith("s3:")) await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: ref.slice(3) }))
    else if (ref.startsWith("/uploads/")) await fs.unlink(path.join(process.cwd(), "public", ref))
  } catch {}
}

export async function readPhoto(key: string) {
  const r = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  return { body: r.Body!.transformToWebStream(), type: r.ContentType ?? "image/jpeg", length: r.ContentLength }
}
