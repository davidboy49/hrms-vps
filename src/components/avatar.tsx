import { cn } from "@/lib/utils"
import { initials } from "@/lib/format"

const TONES = ["bg-blue-500/15 text-blue-700 dark:text-blue-300", "bg-orange-500/15 text-orange-700 dark:text-orange-300", "bg-green-500/15 text-green-700 dark:text-green-300", "bg-purple-500/15 text-purple-700 dark:text-purple-300", "bg-amber-500/15 text-amber-700 dark:text-amber-300", "bg-teal-500/15 text-teal-700 dark:text-teal-300"]

export function PersonAvatar({ name, url, className }: { name: string; url?: string | null; className?: string }) {
  const tone = TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length]
  // "s3:<key>" references live in a private bucket and are served by a signed-in-only route
  const src = url?.startsWith("s3:") ? `/api/photo?key=${encodeURIComponent(url.slice(3))}` : url
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={cn("size-8 shrink-0 rounded-full object-cover", className)} />
  ) : (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold", tone, className)}>{initials(name)}</span>
  )
}
