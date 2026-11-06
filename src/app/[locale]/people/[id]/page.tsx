import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContentPage, LanguageNote, SourcesSection } from "@/components/seo/ContentPage";
import { getRepository } from "@/lib/data/repository";
import { alternates, localizedUrl, snippet } from "@/lib/seo";
import { asLocale, LOCALES, type Locale } from "@/lib/types";
import { clampYear, formatYear, formatYearRange, type Era } from "@/lib/year";

type Props = { params: Promise<{ locale: string; id: string }> };

export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

const load = async (locale: Locale, id: string) => (await (await getRepository()).listPeople(locale)).find((p) => p.id === id) ?? null;

async function ownLanguages(id: string): Promise<Locale[]> {
  const out: Locale[] = [];
  for (const l of LOCALES) if ((await load(l, id))?.content_lang === l) out.push(l);
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, id } = await params;
  const locale = asLocale(raw);
  const person = await load(locale, id);
  if (!person) return {};
  const own = await ownLanguages(id);
  const description = snippet(person.summary || person.name);
  const path = `/people/${id}`;
  return {
    title: person.name,
    description,
    alternates: alternates(locale, path, own),
    robots: own.includes(locale) ? undefined : { index: false, follow: true },
    openGraph: { type: "profile", title: person.name, description, url: localizedUrl(locale, path), ...(person.image_url ? { images: [person.image_url] } : {}) },
  };
}

export default async function PersonPage({ params }: Props) {
  const { locale: raw, id } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  const person = await load(locale, id);
  if (!person) notFound();
  const t = await getTranslations({ locale });
  const era: Era = { bc: t("era.bc"), ad: t("era.ad"), suffix: t("era.position") === "suffix" };
  const events = await (await getRepository()).listEvents(locale);
  const byId = new Map(events.map((e) => [e.id, e]));
  const linked = person.events.flatMap((l) => byId.get(l.event_id) ?? []).sort((a, b) => a.start_year - b.start_year);
  const unknown = t("person.unknown");
  const lived = `${person.birth_year === null ? unknown : formatYear(person.birth_year, era)} – ${person.death_year === null ? unknown : formatYear(person.death_year, era)}`;
  const midYear = person.birth_year !== null && person.death_year !== null ? clampYear((person.birth_year + person.death_year) / 2) : (person.birth_year ?? person.death_year ?? 1453);
  const note =
    person.content_lang !== locale
      ? t("event.languageNote", { lang: new Intl.DisplayNames([locale], { type: "language" }).of(person.content_lang) ?? person.content_lang })
      : null;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.name,
    description: snippet(person.summary || person.name),
    url: localizedUrl(locale, `/people/${id}`),
    ...(person.image_url ? { image: person.image_url } : {}),
    ...(person.wikidata_id ? { sameAs: `https://www.wikidata.org/wiki/${person.wikidata_id}` } : {}),
    // schema.org dates cannot express BCE reliably, so only CE years are stated.
    ...(person.birth_year && person.birth_year > 0 ? { birthDate: String(person.birth_year).padStart(4, "0") } : {}),
    ...(person.death_year && person.death_year > 0 ? { deathDate: String(person.death_year).padStart(4, "0") } : {}),
    ...(person.birth_place ? { birthPlace: person.birth_place.name } : {}),
    ...(person.death_place ? { deathPlace: person.death_place.name } : {}),
  };

  return (
    <ContentPage locale={locale} path={`/people/${id}`} structuredData={structuredData}>
      <article>
        <p className="text-sm text-muted">{t("person.kind")}</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight tracking-tight">{person.name}</h1>
        <p className="mt-1 font-medium text-muted">{lived}</p>
        <Link href={`/${locale}?y=${midYear}&person=${person.id}`} className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink">
          {t("seo.viewOnMap")}
        </Link>
        <LanguageNote note={note} />
        {person.image_url && (
          <figure className="mt-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote Commons redirect; the image optimizer adds nothing here */}
            <img src={person.image_url} alt={person.name} loading="lazy" className="max-h-96 rounded object-contain" />
          </figure>
        )}
        <div className="mt-5 leading-relaxed">{person.description || t("person.noSummary")}</div>
        {person.description && <p className="mt-2 text-xs text-muted">{t("event.wikiLicense")}</p>}
        {(person.birth_place || person.death_place) && (
          <p className="mt-4 text-sm">
            {person.birth_place && `${t("person.born")}: ${person.birth_place.name}`}
            {person.birth_place && person.death_place && " · "}
            {person.death_place && `${t("person.died")}: ${person.death_place.name}`}
          </p>
        )}
        {linked.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 font-serif text-xl font-semibold">{t("person.events")}</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {linked.map((e) => (
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
        <SourcesSection sources={person.sources} locale={locale} />
      </article>
    </ContentPage>
  );
}
