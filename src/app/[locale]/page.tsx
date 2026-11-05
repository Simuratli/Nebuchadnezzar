import { setRequestLocale } from "next-intl/server";
import { AtlasLoader } from "@/components/AtlasLoader";
import { getRepository } from "@/lib/data/repository";
import type { Locale } from "@/lib/types";

type Props = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const repository = await getRepository();
  const language = locale as Locale; // validated by the layout
  const [events, people, routes, tours, cities, corrections] = await Promise.all([
    repository.listEvents(language),
    repository.listPeople(language),
    repository.listRoutes(language),
    repository.listTours(language),
    repository.listCities(language),
    repository.listCorrections(language),
  ]);
  return <AtlasLoader data={{ events, people, routes, tours, cities, corrections }} />;
}
