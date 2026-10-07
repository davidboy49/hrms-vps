import { Clock, Users } from "lucide-react"
import { getT } from "@/i18n/server"

const rise = (ms: number): React.CSSProperties => ({ animationDelay: `${ms}ms` })

export async function LoginArt({ company, logoUrl }: { company: string; logoUrl: string }) {
  const t = await getT()
  return (
    <section className="art-panel hidden flex-col justify-between p-10 text-white lg:flex">
      <span className="art-blob b1" aria-hidden />
      <span className="art-blob b2" aria-hidden />
      <span className="art-blob b3" aria-hidden />
      <span className="art-grid" aria-hidden />
      <span className="art-ring" style={{ width: "34rem", height: "34rem", right: "-12rem", bottom: "-14rem" }} aria-hidden />
      <span className="art-ring" style={{ width: "22rem", height: "22rem", right: "-6rem", bottom: "-8rem", animationDirection: "reverse" }} aria-hidden />

      {/* floating product glimpses */}
      <div className="art-pos art-rise" style={{ right: "9%", top: "13%", ...rise(700) }} aria-hidden>
        <div className="art-card" style={{ animationDuration: "7s" }}>
          <span className="grid size-9 place-items-center rounded-lg bg-white/20">
            <Users className="size-4" />
          </span>
          <span>
            <small>{t("art.present")}</small>
            <b>38 / 40</b>
          </span>
        </div>
      </div>

      <div className="art-pos art-rise" style={{ left: "12%", top: "24%", ...rise(1000) }} aria-hidden>
        <div className="art-card" style={{ animationDuration: "8s", animationDelay: "-2s" }}>
          <span className="relative grid size-9 place-items-center rounded-lg bg-white/20">
            <Clock className="size-4" />
            <span className="art-pulse absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-lime-300" />
          </span>
          <span>
            <small>{t("art.checkin")}</small>
            <b>08:02</b>
          </span>
        </div>
      </div>

      <div className="art-pos art-rise" style={{ right: "12%", bottom: "20%", ...rise(1300) }} aria-hidden>
        <div className="art-card" style={{ flexDirection: "column", alignItems: "flex-start", animationDuration: "9s", animationDelay: "-4s" }}>
          <small>{t("art.headcount")}</small>
          <span className="flex h-10 items-end gap-1.5">
            {[40, 62, 48, 78, 66, 92].map((h, i) => (
              <span key={i} className="art-bar w-2.5 rounded-sm bg-white/80" style={{ height: `${h}%`, animationDelay: `${i * 280}ms` }} />
            ))}
          </span>
        </div>
      </div>

      <div className="art-rise flex items-center gap-2 font-semibold" style={rise(100)}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="size-10 rounded-xl bg-white object-contain p-1" />
        ) : (
          <span className="grid size-8 place-items-center rounded-lg bg-white text-primary">
            <Users className="size-4" />
          </span>
        )}
        {company}
      </div>

      <div className="space-y-3">
        <h1 className="art-rise max-w-[16ch] text-4xl font-semibold leading-tight" style={rise(250)}>
          {t("login.tagline")}
        </h1>
        <p className="art-rise text-sm opacity-80" style={rise(450)}>
          {t("login.taglineSub")}
        </p>
      </div>

      <p className="art-rise text-xs opacity-70" style={rise(600)}>
        {t("login.notice")}
      </p>
    </section>
  )
}
