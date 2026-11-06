import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { jsonLd } from "@/lib/seo";
import { LOCALES, type Locale, type Source } from "@/lib/types";

const NAMES: Record<Locale, string> = { en: "English", tr: "Türkçe", az: "Azərbaycanca" };

/** A plain, fully server-rendered page around one record, readable without JavaScript. */
export async function ContentPage({
  locale,
  path,
  structuredData,
  children,
}: {
  locale: Locale;
  path: string;
  structuredData?: object;
  children: React.ReactNode;
}) {
  const t = await getTranslations({ locale });
  return (
    <div className="min-h-dvh bg-bg">
      {structuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
          <Link href={`/${locale}`} className="font-serif text-lg font-semibold tracking-tight">
            {t("app.title")}
          </Link>
          <Link href={`/${locale}/explore`} className="text-sm text-muted hover:underline">
            {t("seo.explore")}
          </Link>
          <nav aria-label={t("app.language")} className="ml-auto flex gap-3 text-sm">
            {LOCALES.map((l) =>
              l === locale ? (
                <span key={l} aria-current="true" className="font-semibold">
                  {NAMES[l]}
                </span>
              ) : (
                <Link key={l} href={`/${l}${path}`} hrefLang={l} lang={l} className="text-muted hover:underline">
                  {NAMES[l]}
                </Link>
              ),
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto my-6 max-w-3xl rounded-xl border border-line bg-surface px-5 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}

export async function SourcesSection({ sources, locale }: { sources: Source[]; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "event" });
  if (sources.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-2 font-serif text-xl font-semibold">{t("sources")}</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {sources.map((s) => (
          <li key={s.id}>
            {s.url ? (
              <a href={s.url} rel="noopener nofollow" className="text-accent underline">
                {s.title ?? s.url}
              </a>
            ) : (
              s.title
            )}
            {s.publisher && ` · ${s.publisher}`}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LanguageNote({ note }: { note: string | null }) {
  return note ? <p className="mt-3 rounded bg-surface-2 px-3 py-2 text-sm">{note}</p> : null;
}
