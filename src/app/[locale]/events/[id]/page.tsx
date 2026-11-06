import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContentPage, LanguageNote, SourcesSection } from "@/components/seo/ContentPage";
import { getRepository } from "@/lib/data/repository";
import { alternates, localizedUrl, snippet } from "@/lib/seo";
import { asLocale, LOCALES, type CardName, type Locale } from "@/lib/types";
import { formatYearRange, type Era } from "@/lib/year";

type Props = { params: Promise<{ locale: string; id: string }> };

export const dynamicParams = true;
// Pages render on first request and are then cached, which keeps builds small.
export async function generateStaticParams() {
  return [];
}

const load = async (locale: Locale, id: string) => (/^[\w-]{1,64}$/.test(id) ? (await getRepository()).getEvent(id, locale) : null);

/** Languages where this event has its own text, not a fallback. */
async function ownLanguages(id: string): Promise<Locale[]> {
  const repository = await getRepository();
  const out: Locale[] = [];
  for (const l of LOCALES) {
    if ((await repository.getEvent(id, l))?.content_lang === l) out.push(l);
  }
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, id } = await params;
  const locale = asLocale(raw);
  const event = await load(locale, id);
  if (!event) return {};
  const own = await ownLanguages(id);
  const t = await getTranslations({ locale });
  const era: Era = { bc: t("era.bc"), ad: t("era.ad"), suffix: t("era.position") === "suffix" };
  const title = `${event.title} (${formatYearRange(event.start_year, event.end_year, era)})`;
  const description = snippet(event.summary || event.title);
  const path = `/events/${id}`;
  return {
    title,
    description,
    alternates: alternates(locale, path, own),
    // Text shown from another language would only duplicate that language's page.
    robots: own.includes(locale) ? undefined : { index: false, follow: true },
    openGraph: { type: "article", title, description, url: localizedUrl(locale, path), ...(event.image_url ? { images: [event.image_url] } : {}) },
  };
}

export default async function EventPage({ params }: Props) {
  const { locale: raw, id } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  const event = await load(locale, id);
  if (!event) notFound();
  const t = await getTranslations({ locale });
  const era: Era = { bc: t("era.bc"), ad: t("era.ad"), suffix: t("era.position") === "suffix" };
  const when = formatYearRange(event.start_year, event.end_year, era);
  const names = (list: CardName[]) => list.map((n) => n.name).join(", ");
  const card = event.card;
  const sides = card?.sides.filter((s) => s.parties.length || s.commanders.length) ?? [];
  const note =
    event.content_lang !== locale
      ? t("event.languageNote", { lang: new Intl.DisplayNames([locale], { type: "language" }).of(event.content_lang) ?? event.content_lang })
      : null;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: event.title,
    description: snippet(event.summary || event.title),
    inLanguage: event.content_lang,
    mainEntityOfPage: localizedUrl(locale, `/events/${id}`),
    ...(event.image_url ? { image: event.image_url } : {}),
    ...(event.wikidata_id ? { about: { "@type": "Thing", name: event.title, sameAs: `https://www.wikidata.org/wiki/${event.wikidata_id}` } } : {}),
    isBasedOn: event.sources.flatMap((s) => s.url ?? []),
    isPartOf: { "@type": "WebSite", name: t("app.title"), url: localizedUrl(locale) },
  };

  return (
    <ContentPage locale={locale} path={`/events/${id}`} structuredData={structuredData}>
      <article>
        <p className="text-sm text-muted">{t(`categories.${event.category}`)}</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight tracking-tight">{event.title}</h1>
        <p className="mt-1 font-medium text-muted">{when}</p>
        <p className="mt-1 text-sm text-muted">{event.region_tags.map((r) => t(`regions.${r}`)).join(" · ")}</p>
        <Link
          href={`/${locale}?y=${event.start_year}&e=${event.id}`}
          data-testid="view-on-map"
          className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
        >
          {t("seo.viewOnMap")}
        </Link>
        <LanguageNote note={note} />
        {event.image_url && (
          <figure className="mt-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote Commons redirect; the image optimizer adds nothing here */}
            <img src={event.image_url} alt={event.title} loading="lazy" className="max-h-96 w-full rounded object-cover" />
          </figure>
        )}
        <div className="mt-5 leading-relaxed">{event.description || event.summary || t("event.noSummary")}</div>
        {event.description && <p className="mt-2 text-xs text-muted">{t("event.wikiLicense")}</p>}

        {card && (
          <section className="mt-8">
            <h2 className="mb-2 font-serif text-xl font-semibold">{t("facts.title")}</h2>
            <dl className="divide-y divide-line text-sm">
              {card.places.length > 0 && (
                <div className="grid grid-cols-[8rem_1fr] gap-2 py-1.5">
                  <dt className="text-muted">{t("facts.place")}</dt>
                  <dd>{names(card.places)}</dd>
                </div>
              )}
              {card.part_of.length > 0 && (
                <div className="grid grid-cols-[8rem_1fr] gap-2 py-1.5">
                  <dt className="text-muted">{t("facts.partOf")}</dt>
                  <dd>{names(card.part_of)}</dd>
                </div>
              )}
              {sides.map((s, i) => (
                <div key={i} className="grid grid-cols-[8rem_1fr] gap-2 py-1.5">
                  <dt className="text-muted">{t("facts.side", { number: i + 1 })}</dt>
                  <dd>
                    {names(s.parties)}
                    {s.commanders.length > 0 && <p className="text-muted">{t("facts.commanders")}: {names(s.commanders)}</p>}
                  </dd>
                </div>
              ))}
              {card.signatories.length > 0 && (
                <div className="grid grid-cols-[8rem_1fr] gap-2 py-1.5">
                  <dt className="text-muted">{t("facts.signatories")}</dt>
                  <dd>{names(card.signatories)}</dd>
                </div>
              )}
              {card.result && (
                <div className="grid grid-cols-[8rem_1fr] gap-2 py-1.5">
                  <dt className="text-muted">{t("facts.result")}</dt>
                  <dd lang="en">{card.result}</dd>
                </div>
              )}
            </dl>
          </section>
        )}
        <SourcesSection sources={event.sources} locale={locale} />
      </article>
    </ContentPage>
  );
}
