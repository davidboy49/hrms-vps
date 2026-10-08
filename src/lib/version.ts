import pkg from "../../package.json"
import { APP_TZ } from "./format"

const builtFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: APP_TZ })

/**
 * "v0.1.0 · 8040efa · 08/10/2026 18:30". The commit and build time are baked into the image by the deploy
 * (APP_COMMIT, APP_BUILT, see Dockerfile); a build without them shows "dev".
 */
export function versionLabel() {
  const commit = process.env.APP_COMMIT || "dev"
  const built = process.env.APP_BUILT ? new Date(process.env.APP_BUILT) : null
  return [`v${pkg.version}`, commit, built && !Number.isNaN(built.getTime()) ? builtFmt.format(built).replace(",", "") : null].filter(Boolean).join(" · ")
}
