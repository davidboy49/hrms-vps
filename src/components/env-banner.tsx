/** Shown only when APP_ENV_LABEL is set (the QAS test copy), so nobody mistakes it for the real system. */
export function EnvBanner() {
  const label = process.env.APP_ENV_LABEL
  if (!label) return null
  return (
    <div className="bg-amber-500 px-3 py-1 text-center text-xs font-semibold text-black print:hidden" role="note">
      {label} · test environment · fake data, nothing here is real
    </div>
  )
}
