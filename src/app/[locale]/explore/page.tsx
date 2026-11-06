import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContentPage } from "@/components/seo/ContentPage";
import { getRepository } from "@/lib/data/repository";
import { alternates, localizedUrl } from "@/lib/seo";
import { asLocale, CATEGORIES } from "@/lib/types";
import { formatYearRange, type Era } from "@/lib/year";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "seo" });
  return {
    title: t("exploreTitle"),
    description: t("exploreDescription"),
    alternates: alternates(locale, "/explore"),
    openGraph: { title: t("exploreTitle"), description: t("exploreDescription"), url: localizedUrl(locale, "/explore") },
  };
}

/** The crawlable index of every record, linked from the map. */
export default async function ExplorePage({ params }: Props) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const era: Era = { bc: t("era.bc"), ad: t("era.ad"), suffix: t("era.position") === "suffix" };
  const repository = await getRepository();
  const [events, people, cities] = await Promise.all([repository.listEvents(locale), repository.listPeople(locale), repository.listCities(locale)]);
  const byName = <T extends { name: string }>(list: T[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, locale));

  return (
    <ContentPage locale={locale} path="/explore">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">{t("seo.exploreTitle")}</h1>
      <p className="mt-2 text-muted">{t("seo.exploreDescription")}</p>

      <section className="mt-8">
        <h2 className="mb-2 font-serif text-xl font-semibold">{t("seo.people")}</h2>
        <ul className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2" data-testid="explore-people">
          {byName(people).map((p) => (
            <li key={p.id}>
              <Link href={`/${locale}/people/${p.id}`} className="text-accent underline">
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-serif text-xl font-semibold">{t("seo.cities")}</h2>
        <ul className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-3" data-testid="explore-cities">
          {byName(cities).map((c) => (
            <li key={c.id}>
              <Link href={`/${locale}/cities/${c.id}`} className="text-accent underline">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {CATEGORIES.map((category) => {
        const list = events.filter((e) => e.category === category).sort((a, b) => a.start_year - b.start_year);
        if (list.length === 0) return null;
        return (
          <section key={category} className="mt-8">
            <h2 className="mb-2 font-serif text-xl font-semibold">{t(`categories.${category}`)}</h2>
            <ul className="space-y-1 text-sm" data-testid={`explore-${category}`}>
              {list.map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <Link href={`/${locale}/events/${e.id}`} className="text-accent underline">
                    {e.title}
                  </Link>
                  <span className="shrink-0 text-muted">{formatYearRange(e.start_year, e.end_year, era)}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </ContentPage>
  );
}
