import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AtlasLoader } from "@/components/AtlasLoader";
import { getRepository } from "@/lib/data/repository";
import { jsonLd, localizedUrl, SITE_URL } from "@/lib/seo";
import type { Locale } from "@/lib/types";

type Props = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const repository = await getRepository();
  const language = locale as Locale; // validated by the layout
  const [t, events, people, routes, tours, cities, corrections, polities] = await Promise.all([
    getTranslations({ locale }),
    repository.listEvents(language),
    repository.listPeople(language),
    repository.listRoutes(language),
    repository.listTours(language),
    repository.listCities(language),
    repository.listCorrections(language),
    repository.listPolities(language),
  ]);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: t("app.title"),
    description: t("seo.homeDescription"),
    url: localizedUrl(language),
    inLanguage: language,
    publisher: { "@type": "Organization", name: t("app.title"), url: SITE_URL },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      {/* The map draws on the client, so this gives crawlers and screen readers its text and links. */}
      <div className="sr-only">
        <h1>
          {t("app.title")}: {t("seo.homeTitle")}
        </h1>
        <p>{t("seo.homeDescription")}</p>
        <Link href={`/${locale}/explore`}>{t("seo.exploreTitle")}</Link>
      </div>
      <AtlasLoader data={{ events, people, routes, tours, cities, corrections, polities }} />
    </>
  );
}
