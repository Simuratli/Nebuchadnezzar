import type { MetadataRoute } from "next";
import { getRepository } from "@/lib/data/repository";
import { localizedUrl } from "@/lib/seo";
import { LOCALES, type Locale } from "@/lib/types";

/** Lists a page once per language that has its own text; fallback versions are noindex. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const repository = await getRepository();
  const out: MetadataRoute.Sitemap = [];

  const add = (path: string, langs: readonly Locale[], priority: number) => {
    const languages = Object.fromEntries(langs.map((l) => [l, localizedUrl(l, path)]));
    for (const l of langs) out.push({ url: localizedUrl(l, path), alternates: { languages }, priority });
  };

  add("", LOCALES, 1);
  add("/explore", LOCALES, 0.8);

  const collect = async <T extends { id: string; content_lang: string }>(list: (l: Locale) => Promise<T[]>, prefix: string, priority: number) => {
    const langsById = new Map<string, Locale[]>();
    for (const l of LOCALES) {
      for (const item of await list(l)) {
        if (item.content_lang === l) langsById.set(item.id, [...(langsById.get(item.id) ?? []), l]);
      }
    }
    for (const [id, langs] of langsById) add(`/${prefix}/${id}`, langs, priority);
  };

  await collect((l) => repository.listEvents(l), "events", 0.6);
  await collect((l) => repository.listPeople(l), "people", 0.6);
  await collect((l) => repository.listCities(l), "cities", 0.6);
  return out;
}
