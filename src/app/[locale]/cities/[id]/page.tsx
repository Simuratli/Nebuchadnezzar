import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContentPage, LanguageNote, SourcesSection } from "@/components/seo/ContentPage";
import { eventsNearCity, NEARBY_KM } from "@/lib/cities";
import { getRepository } from "@/lib/data/repository";
import { alternates, localizedUrl, snippet } from "@/lib/seo";
import { asLocale, LOCALES, type Locale } from "@/lib/types";
import { formatYear, formatYearRange, type Era } from "@/lib/year";

type Props = { params: Promise<{ locale: string; id: string }> };

export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

const load = async (locale: Locale, id: string) => (await (await getRepository()).listCities(locale)).find((c) => c.id === id) ?? null;

async function ownLanguages(id: string): Promise<Locale[]> {
  const out: Locale[] = [];
  for (const l of LOCALES) if ((await load(l, id))?.content_lang === l) out.push(l);
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, id } = await params;
  const locale = asLocale(raw);
  const city = await load(locale, id);
  if (!city) return {};
  const own = await ownLanguages(id);
  const description = snippet(city.summary || city.name);
  const path = `/cities/${id}`;
  return {
    title: city.name,
    description,
    alternates: alternates(locale, path, own),
    robots: own.includes(locale) ? undefined : { index: false, follow: true },
    openGraph: { type: "article", title: city.name, description, url: localizedUrl(locale, path) },
  };
}

export default async function CityPage({ params }: Props) {
  const { locale: raw, id } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  const city = await load(locale, id);
  if (!city) notFound();
  const t = await getTranslations({ locale });
  const era: Era = { bc: t("era.bc"), ad: t("era.ad"), suffix: t("era.position") === "suffix" };
  const near = eventsNearCity(await (await getRepository()).listEvents(locale), city);
  const bound = (y: number | null, fallback: string) => (y === null ? fallback : formatYear(y, era));
  const note =
    city.content_lang !== locale
      ? t("event.languageNote", { lang: new Intl.DisplayNames([locale], { type: "language" }).of(city.content_lang) ?? city.content_lang })
      : null;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "City",
    name: city.name,
    description: snippet(city.summary || city.name),
    url: localizedUrl(locale, `/cities/${id}`),
    alternateName: [...new Set([...city.periods.map((p) => p.name), ...city.other_names])].filter((n) => n !== city.name),
    geo: { "@type": "GeoCoordinates", latitude: city.lat, longitude: city.lng },
    ...(city.wikidata_id ? { sameAs: `https://www.wikidata.org/wiki/${city.wikidata_id}` } : {}),
  };

  return (
    <ContentPage locale={locale} path={`/cities/${id}`} structuredData={structuredData}>
      <article>
        <p className="text-sm text-muted">{t("city.kind")}</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight tracking-tight">{city.name}</h1>
        <Link href={`/${locale}?city=${city.id}&lat=${city.lat}&lng=${city.lng}&z=6`} className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink">
          {t("seo.viewOnMap")}
        </Link>
        <LanguageNote note={note} />
        {city.summary && <p className="mt-5 leading-relaxed">{city.summary}</p>}

        {(city.periods.length > 0 || city.other_names.length > 0) && (
          <section className="mt-8">
            <h2 className="mb-2 font-serif text-xl font-semibold">{t("city.names")}</h2>
            <ul className="divide-y divide-line text-sm">
              {city.periods.map((p) => (
                <li key={`${p.name}-${p.from}`} className="flex justify-between gap-2 py-1.5">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted">
                    {bound(p.from, t("city.unknownStart"))} – {bound(p.to, t("city.present"))}
                    {!p.confirmed && ` (${t("city.unconfirmed")})`}
                  </span>
                </li>
              ))}
            </ul>
            {city.other_names.length > 0 && (
              <p className="mt-2 text-sm">
                <span className="text-muted">{t("city.otherNames")}: </span>
                {city.other_names.join(", ")} ({t("city.unconfirmed")})
              </p>
            )}
          </section>
        )}

        <section className="mt-8">
          <h2 className="mb-2 font-serif text-xl font-semibold">{t("city.rulers")}</h2>
          <p className="mb-2 rounded bg-warn-bg px-3 py-2 text-xs text-warn-ink">{t("city.rulersWarning")}</p>
          <ul className="divide-y divide-line text-sm">
            {city.rulers.map((r) => (
              <li key={r.from} className="flex justify-between gap-2 py-1.5">
                <span>
                  {r.name ?? t("city.unknownRuler")}
                  {r.manual && <span className="text-muted"> ({t("city.manualRuler")})</span>}
                </span>
                <span className="shrink-0 text-muted">
                  {formatYear(r.from, era)} – {formatYear(r.to, era)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {near.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 font-serif text-xl font-semibold">{t("city.events", { km: NEARBY_KM })}</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {near.map((e) => (
                <li key={e.id}>
                  <Link href={`/${locale}/events/${e.id}`} className="text-accent underline">
                    {e.title}
                  </Link>{" "}
                  <span className="text-muted">{formatYearRange(e.start_year, e.end_year, era)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <SourcesSection sources={city.sources} locale={locale} />
      </article>
    </ContentPage>
  );
}
