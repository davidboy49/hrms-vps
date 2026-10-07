import { cn } from "@/lib/utils"

const TONES: Record<string, string> = {
  green: "bg-green-500/15 text-green-700 dark:text-green-300",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  red: "bg-red-500/15 text-red-700 dark:text-red-300",
  gray: "bg-muted text-muted-foreground",
}

export function StatusBadge({ name, color }: { name: string; color: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", TONES[color] ?? TONES.gray)}>
      <span className="size-1.5 rounded-full bg-current" />
      {name}
    </span>
  )
}
