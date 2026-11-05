import { setRequestLocale } from "next-intl/server";
import { AtlasLoader } from "@/components/AtlasLoader";
import { getRepository } from "@/lib/data/repository";

type Props = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const repository = await getRepository();
  const [events, people, routes, tours, cities, corrections] = await Promise.all([
    repository.listEvents(),
    repository.listPeople(),
    repository.listRoutes(),
    repository.listTours(),
    repository.listCities(),
    repository.listCorrections(),
  ]);
  return <AtlasLoader data={{ events, people, routes, tours, cities, corrections }} />;
}
