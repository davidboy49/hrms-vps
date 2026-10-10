import { requirePerm } from "@/lib/session"
import { GUIDE } from "@/content/guide.generated"
import { getLocale, getT, titleOf } from "@/i18n/server"
import { PageHeader } from "@/components/page-header"

export const generateMetadata = titleOf("nav.guide")
export const dynamic = "force-dynamic"

// The guide is fixed text that ships with the app (see scripts/build-guide.py), so it is safe to render as HTML.
// It sits inside the signed-in area, so only people with an account can read it.
export default async function GuidePage() {
  await requirePerm("guide.view")
  const t = await getT()
  const doc = GUIDE[await getLocale()]
  return (
    <>
      <PageHeader title={doc.title} description={t("guide.desc")} />
      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label={t("guide.contents")} className="lg:sticky lg:top-4 lg:self-start">
          <ol className="flex flex-wrap gap-1.5 text-sm lg:flex-col lg:gap-0.5">
            {doc.toc.map((h) => (
              <li key={h.id}>
                <a href={`#${h.id}`} className="block rounded-md border px-2.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground lg:border-0 lg:border-s-2 lg:rounded-none">
                  {h.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="guide min-w-0 max-w-3xl" dangerouslySetInnerHTML={{ __html: doc.html }} />
      </div>
    </>
  )
}
