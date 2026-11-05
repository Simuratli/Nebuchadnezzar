import content from "../../../data/i18n/content.json";
import {
  LOCALES,
  type CardName,
  type City,
  type Correction,
  type EventCard,
  type HistoricalEvent,
  type HistoricalRoute,
  type Locale,
  type NameI18n,
  type Person,
  type Polity,
  type Source,
  type StoredCard,
  type StoredCity,
  type StoredEvent,
  type StoredPerson,
  type StoredPolity,
  type Tour,
} from "@/lib/types";

const dictionary = content as Record<string, Partial<Record<Locale, string>>>;

/** Hand-written content is authored in Turkish; data/i18n/content.json holds the other languages. */
export function translate(text: string, locale: Locale): string {
  return locale === "tr" ? text : (dictionary[text]?.[locale] ?? text);
}

/** The requested language first, then English as the common fallback, then whatever exists. */
const fallbackOrder = (locale: Locale): Locale[] => [...new Set<Locale>([locale, "en", ...LOCALES])];

function pick<K extends string>(i18n: Partial<Record<Locale, Partial<Record<K, string>>>>, locale: Locale, key: K): { value: string; lang: Locale } {
  for (const lang of fallbackOrder(locale)) {
    const value = i18n[lang]?.[key];
    if (value) return { value, lang };
  }
  return { value: "", lang: locale };
}

/** Keeps language-neutral records plus the article in the best available language. */
export function localizeSources(sources: Source[], locale: Locale, title: string): Source[] {
  const best = fallbackOrder(locale).find((lang) => sources.some((s) => s.lang === lang));
  return sources.filter((s) => s.lang === null || s.lang === best).map((s) => ({ ...s, title: s.title ?? title }));
}

export function localizeEvent(e: StoredEvent, locale: Locale): HistoricalEvent {
  const { i18n, ...rest } = e;
  const title = pick(i18n, locale, "title");
  const summary = pick(i18n, locale, "summary");
  // The article text and its summary come from the same language, so they move together.
  const description = i18n[summary.lang]?.description ?? "";
  return { ...rest, title: title.value, summary: summary.value, description, content_lang: summary.value ? summary.lang : title.lang };
}

export function localizePerson(p: StoredPerson, locale: Locale): Person {
  const { i18n, ...rest } = p;
  const name = pick(i18n, locale, "name");
  const summary = pick(i18n, locale, "summary");
  const place = (where: StoredPerson["birth_place"]) =>
    where && { name: where.i18n?.[locale] ?? where.name, lng: where.lng, lat: where.lat };
  return {
    ...rest,
    name: name.value,
    summary: summary.value,
    description: i18n[summary.lang]?.description ?? "",
    content_lang: summary.value ? summary.lang : name.lang,
    birth_place: place(p.birth_place),
    death_place: place(p.death_place),
    sources: localizeSources(p.sources, locale, name.value),
  };
}

export function localizeCity(c: StoredCity, locale: Locale): City {
  const { i18n, ...rest } = c;
  const name = pick(i18n, locale, "name");
  const summary = pick(i18n, locale, "summary");
  return {
    ...rest,
    name: name.value,
    summary: summary.value,
    content_lang: summary.value ? summary.lang : name.lang,
    periods: c.periods.map((p) => ({ ...p, name: translate(p.name, locale) })),
    other_names: c.other_names.map((n) => translate(n, locale)),
    rulers: c.rulers.map((r) => ({ ...r, name: r.name && translate(r.name, locale) })),
    sources: localizeSources(c.sources, locale, name.value),
  };
}

const localName = (n: NameI18n, locale: Locale): CardName => ({
  name: fallbackOrder(locale).map((l) => n[l]).find(Boolean) ?? "",
  qid: n.qid ?? null,
});

export function localizeCard(card: StoredCard | undefined | null, locale: Locale): EventCard | null {
  if (!card) return null;
  const names = (list: NameI18n[]) => list.map((n) => localName(n, locale)).filter((n) => n.name);
  return {
    parties: names(card.parties),
    part_of: names(card.part_of),
    places: names(card.places),
    signatories: names(card.signatories),
    sides: card.sides.map((s) => ({ parties: names(s.parties), commanders: names(s.commanders) })),
    result: card.result,
  };
}

export function localizePolity(p: StoredPolity, locale: Locale): Polity {
  const { i18n, ...rest } = p;
  return { ...rest, name: fallbackOrder(locale).map((l) => i18n[l]).find(Boolean) ?? p.id };
}

export function localizeRoute(r: HistoricalRoute, locale: Locale): HistoricalRoute {
  return {
    ...r,
    title: translate(r.title, locale),
    waypoints: r.waypoints.map((w) => ({ ...w, place: translate(w.place, locale), note: translate(w.note, locale) })),
  };
}

export function localizeTour(t: Tour, locale: Locale): Tour {
  return {
    ...t,
    title: translate(t.title, locale),
    description: translate(t.description, locale),
    steps: t.steps.map((s) => ({ ...s, title: translate(s.title, locale), text: translate(s.text, locale) })),
  };
}

export function localizeCorrection(c: Correction, locale: Locale): Correction {
  return {
    ...c,
    slices: c.slices.map((s) => ({ ...s, name: translate(s.name, locale), note: s.note && translate(s.note, locale) })),
  };
}
