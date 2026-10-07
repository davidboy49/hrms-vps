/** Shift colours used in the roster and templates. Each is a background and text pair that reads on light and dark themes. */
export const SHIFT_COLOURS: Record<string, string> = {
  blue: "bg-blue-600 text-white",
  teal: "bg-teal-600 text-white",
  green: "bg-green-600 text-white",
  lime: "bg-lime-600 text-white",
  amber: "bg-amber-500 text-black",
  orange: "bg-orange-500 text-white",
  rose: "bg-rose-600 text-white",
  purple: "bg-purple-600 text-white",
  slate: "bg-slate-600 text-white",
}

export const SHIFT_COLOUR_KEYS = Object.keys(SHIFT_COLOURS)

export const shiftClass = (colour: string | null | undefined) => SHIFT_COLOURS[colour ?? ""] ?? SHIFT_COLOURS.blue

/** Fixed colours for non-shift cells in the roster. */
export const OFF_CLASS = "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
export const HOLIDAY_CLASS = "bg-fuchsia-500/80 text-white"
export const LEAVE_CLASS = "bg-yellow-400 text-black"
