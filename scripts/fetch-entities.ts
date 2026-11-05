/**
 * Builds data/seed/people.json and data/seed/cities.json. Needs data/seed/events.json
 * (npm run data:wikidata) and public/data/boundaries (npm run data:boundaries).
 *
 *   npm run data:entities
 *
 * Hand-curated input lives in data/manual. Nothing is invented: city name periods
 * that Wikidata cannot confirm and hand-made person-event links stay flagged.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { storedCitySchema, storedPersonSchema, type Correction, type Locale, type Source, type StoredCity, type StoredEvent, type StoredPerson } from "../src/lib/types";
import { applyRulerOverrides, mergeRulers, periodConfirmed, rulerAt, type AreaFeature, type AreaGeometry } from "./geo-utils";
import { cachedSparql, fetchExtracts, root, seedDir, WIKI_PUBLISHER, wikiUri, wikiUrl, type Binding } from "./wikidata-client";
import { parseWktPoint, trimToSentence, wikidataTimeToYear } from "./wikidata-utils";

const LAST_YEAR = 1950;
const accessed = new Date().toISOString().slice(0, 10);
const readJson = <T>(...path: string[]) => JSON.parse(readFileSync(join(root, ...path), "utf8")) as T;
const qidOf = (b: Binding, key = "item") => b[key]?.value.split("/").pop() ?? null;

const LABELS = `
  OPTIONAL { ?item rdfs:label ?trLabel FILTER(LANG(?trLabel) = "tr") }
  OPTIONAL { ?item rdfs:label ?enLabel FILTER(LANG(?enLabel) = "en") }
  OPTIONAL { ?item rdfs:label ?azLabel FILTER(LANG(?azLabel) = "az") }
  OPTIONAL { ?trWiki schema:about ?item; schema:isPartOf <https://tr.wikipedia.org/>; schema:name ?trTitle }
  OPTIONAL { ?azWiki schema:about ?item; schema:isPartOf <https://az.wikipedia.org/>; schema:name ?azTitle }`;

type Titles = Record<Locale, string | undefined>;

function wikiSources(ownerId: string, qid: string | null, titles: Titles): Source[] {
  const common = {
    event_id: ownerId,
    type: "ansiklopedi" as const,
    author: null,
    year: null,
    pages: null,
    reliability: 1,
    accessed_at: accessed,
    needs_review: false,
  };
  const out: Source[] = [];
  if (qid) out.push({ ...common, id: `${ownerId}-wikidata`, title: null, publisher: "Wikidata", url: `https://www.wikidata.org/wiki/${qid}`, lang: null });
  for (const lang of ["en", "tr", "az"] as const) {
    const title = titles[lang];
    if (title) out.push({ ...common, id: `${ownerId}-${lang}wiki`, title, publisher: WIKI_PUBLISHER[lang], url: wikiUrl(lang, title), lang });
  }
  return out;
}

/** Reads lead sections for one language at a time, which suits the per-language API. */
async function extractsByLang(items: Titles[]): Promise<Record<Locale, Map<string, string>>> {
  const titles = (lang: Locale) => items.flatMap((t) => (t[lang] ? [t[lang] as string] : []));
  return { en: await fetchExtracts("en", titles("en")), tr: await fetchExtracts("tr", titles("tr")), az: await fetchExtracts("az", titles("az")) };
}

const hasText = (i18n: Record<string, { summary?: string } | undefined>) => Object.values(i18n).some((v) => v?.summary);

const placeOf = (b: Binding, prefix: "birth" | "death") => {
  const name = b[`${prefix}Name`]?.value;
  const point = b[`${prefix}Coord`] ? parseWktPoint(b[`${prefix}Coord`]?.value ?? "") : null;
  if (!name || !point) return null;
  const tr = b[`${prefix}Tr`]?.value;
  const az = b[`${prefix}Az`]?.value;
  return { name, lng: point[0], lat: point[1], i18n: { ...(tr && { tr }), ...(az && { az }) } };
};

async function buildPeople(events: StoredEvent[]): Promise<StoredPerson[]> {
  const list = readJson<{ id: string; enwiki: string }[]>("data", "manual", "people.json");
  const manualLinks = readJson<Record<string, string[]>>("data", "manual", "person-events.json");
  const eventIds = new Set(events.map((ev) => ev.id));
  // data/manual/person-events.json names events by title, in whichever language they had one.
  const byTitle = new Map(events.flatMap((ev) => Object.values(ev.i18n).flatMap((v) => (v.title ? [[v.title, ev.id] as const] : []))));

  const base = new Map<string, { b: Binding; links: Set<string>; titles: Titles }>();
  for (const p of list) {
    const found = await cachedSparql(
      `person3-${p.id}`,
      `SELECT ?item ?trLabel ?enLabel ?azLabel ?trTitle ?azTitle ?birth ?death ?human ?img ?birthName ?birthTr ?birthAz ?birthCoord ?deathName ?deathTr ?deathAz ?deathCoord WHERE {
        ${wikiUri(p.enwiki)} schema:about ?item.
        ${LABELS}
        OPTIONAL { ?item wdt:P569 ?birth }
        OPTIONAL { ?item wdt:P570 ?death }
        OPTIONAL { ?item wdt:P18 ?img }
        OPTIONAL { ?item wdt:P31 wd:Q5. BIND(1 AS ?human) }
        OPTIONAL { ?item wdt:P19 ?bp. ?bp wdt:P625 ?birthCoord. ?bp rdfs:label ?birthName FILTER(LANG(?birthName) = "en") OPTIONAL { ?bp rdfs:label ?birthTr FILTER(LANG(?birthTr) = "tr") } OPTIONAL { ?bp rdfs:label ?birthAz FILTER(LANG(?birthAz) = "az") } }
        OPTIONAL { ?item wdt:P20 ?dp. ?dp wdt:P625 ?deathCoord. ?dp rdfs:label ?deathName FILTER(LANG(?deathName) = "en") OPTIONAL { ?dp rdfs:label ?deathTr FILTER(LANG(?deathTr) = "tr") } OPTIONAL { ?dp rdfs:label ?deathAz FILTER(LANG(?deathAz) = "az") } }
      } LIMIT 1`,
    );
    const b = found[0];
    const qid = b ? qidOf(b) : null;
    if (!b?.human || !qid) {
      console.warn(`KISI ATLANDI: ${p.enwiki}`);
      continue;
    }
    const linkRows = await cachedSparql(
      `person-links-${p.id}`,
      `SELECT DISTINCT ?e WHERE {
        BIND(wd:${qid} AS ?p)
        { ?p wdt:P607 ?e } UNION { ?p wdt:P793 ?e } UNION { ?e wdt:P710 ?p } UNION { ?e wdt:P112 ?p } UNION { ?e wdt:P1037 ?p } UNION { ?e wdt:P84 ?p } UNION { ?e wdt:P61 ?p }
      }`,
    );
    base.set(p.id, {
      b,
      links: new Set(linkRows.map((r) => qidOf(r, "e") ?? "").filter((id) => eventIds.has(id))),
      titles: { en: p.enwiki, tr: b.trTitle?.value, az: b.azTitle?.value },
    });
  }

  const extracts = await extractsByLang([...base.values()].map((v) => v.titles));
  const people: StoredPerson[] = [];
  for (const p of list) {
    const entry = base.get(p.id);
    if (!entry) continue;
    const { b, links, titles } = entry;
    const qid = qidOf(b);
    const manual = (manualLinks[p.id] ?? []).flatMap((title) => {
      const id = byTitle.get(title);
      if (!id) console.warn(`BAGLANTI BULUNAMADI ${p.id}: ${title}`);
      return id && !links.has(id) ? [id] : [];
    });
    const i18n: StoredPerson["i18n"] = {};
    const labels: Titles = { en: b.enLabel?.value, tr: b.trLabel?.value ?? b.trTitle?.value, az: b.azLabel?.value ?? b.azTitle?.value };
    for (const lang of ["en", "tr", "az"] as const) {
      const title = titles[lang];
      const text = title ? extracts[lang].get(title) : undefined;
      if (labels[lang] || text) i18n[lang] = { name: labels[lang], summary: text && trimToSentence(text, 240), description: text && trimToSentence(text, 1400) };
    }
    people.push({
      id: p.id,
      birth_year: b.birth ? wikidataTimeToYear(b.birth.value) : null,
      death_year: b.death ? wikidataTimeToYear(b.death.value) : null,
      wikidata_id: qid,
      image_url: b.img ? `${b.img.value.replace(/^http:/, "https:")}?width=480` : null,
      birth_place: placeOf(b, "birth"),
      death_place: placeOf(b, "death"),
      events: [...[...links].map((event_id) => ({ event_id, manual: false })), ...manual.map((event_id) => ({ event_id, manual: true }))],
      sources: wikiSources(p.id, qid, titles),
      i18n,
      needs_review: !hasText(i18n) || manual.length > 0,
    });
  }
  return people;
}

type ManualCity = {
  id: string;
  enwiki: string;
  name: string;
  periods: { name: string; from: number | null; to: number | null }[];
  other_names: string[];
};

async function buildCities(): Promise<StoredCity[]> {
  const list = readJson<ManualCity[]>("data", "manual", "cities.json");
  const overrides = readJson<Record<string, { from: number; to: number; name: string }[]>>("data", "manual", "ruler-overrides.json");
  const manifest = readJson<{ year: number; file: string }[]>("public", "data", "boundaries", "manifest.json");
  const corrections = readJson<Correction[]>("data", "seed", "corrections.json");
  const correctionAreas: AreaFeature[] = readJson<{ features: { properties: { group: string }; geometry: AreaGeometry }[] }>("public", "data", "corrections", "south-caucasus.json").features.map(
    (f) => ({ geometry: f.geometry, properties: { NAME: f.properties.group } }),
  );
  // Tight enough to catch coastal Batum without pulling in Derbent, just north of the region.
  const REGION_TOLERANCE_DEGREES = 0.15;
  const maps = manifest.map((m) => ({
    year: m.year,
    features: readJson<{ features: AreaFeature[] }>("public", "data", "boundaries", m.file).features,
  }));

  const cities: StoredCity[] = [];
  const found = new Map<string, Binding>();
  for (const c of list) {
    const rows = await cachedSparql(
      `city3-${c.id}`,
      `SELECT ?item ?trLabel ?enLabel ?azLabel ?trTitle ?azTitle ?coord WHERE { ${wikiUri(c.enwiki)} schema:about ?item. ${LABELS} ?item wdt:P625 ?coord. } LIMIT 1`,
    );
    if (!rows[0]) {
      console.warn(`SEHIR BULUNAMADI: ${c.enwiki}`);
      continue;
    }
    found.set(c.id, rows[0]);
  }
  const live = list.filter((c) => found.has(c.id));
  const titlesOf = (c: ManualCity): Titles => {
    const b = found.get(c.id) as Binding;
    return { en: c.enwiki, tr: b.trTitle?.value, az: b.azTitle?.value };
  };
  const extracts = await extractsByLang(live.map(titlesOf));

  for (const c of live) {
    const b = found.get(c.id) as Binding;
    const qid = qidOf(b);
    const point = parseWktPoint(b.coord?.value ?? "");
    if (!point) {
      console.warn(`KOORDINAT OKUNAMADI: ${c.enwiki}`);
      continue;
    }
    const nameRows = await cachedSparql(
      `city-names-${c.id}`,
      `SELECT ?start ?end WHERE { wd:${qid} p:P1448 ?st. OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end } }`,
    );
    const statements = nameRows.map((r) => ({
      start: r.start ? wikidataTimeToYear(r.start.value) : null,
      end: r.end ? wikidataTimeToYear(r.end.value) : null,
    }));
    const periods = c.periods.map((p) => ({ ...p, confirmed: periodConfirmed(p, statements) }));
    const rulers = applyRulerOverrides(
      mergeRulers(
        maps.map((m) => ({ year: m.year, name: rulerAt(point, m.features) })),
        LAST_YEAR,
      ),
      [
        ...(overrides[c.id] ?? []),
        // A city inside the corrected region takes its 1800-1920 rulers from that layer.
        ...(corrections.find((k) => k.id === rulerAt(point, correctionAreas, REGION_TOLERANCE_DEGREES))?.slices ?? []),
      ],
    );
    const titles = titlesOf(c);
    const i18n: StoredCity["i18n"] = {};
    const names: Titles = { en: b.enLabel?.value, tr: c.name, az: b.azLabel?.value ?? b.azTitle?.value };
    for (const lang of ["en", "tr", "az"] as const) {
      const title = titles[lang];
      const text = title ? extracts[lang].get(title) : undefined;
      if (names[lang] || text) i18n[lang] = { name: names[lang], summary: text && trimToSentence(text, 320) };
    }
    cities.push({
      id: c.id,
      wikidata_id: qid,
      lng: point[0],
      lat: point[1],
      periods,
      other_names: c.other_names,
      rulers,
      sources: wikiSources(c.id, qid, titles),
      i18n,
      // Ruler lists are always approximate, so that warning is shown separately on every city.
      needs_review: !hasText(i18n) || periods.some((p) => !p.confirmed) || c.other_names.length > 0,
    });
  }
  return cities;
}

async function main() {
  const events = readJson<StoredEvent[]>("data", "seed", "events.json");
  const people = (await buildPeople(events)).map((p) => storedPersonSchema.parse(p));
  writeFileSync(join(seedDir, "people.json"), `${JSON.stringify(people, null, 1)}\n`);
  const cities = (await buildCities()).map((c) => storedCitySchema.parse(c));
  writeFileSync(join(seedDir, "cities.json"), `${JSON.stringify(cities, null, 1)}\n`);

  console.log(`Kisi: ${people.length}, baglanti: ${people.reduce((n, p) => n + p.events.length, 0)}`);
  console.log(`Sehir: ${cities.length}, ad donemi: ${cities.reduce((n, c) => n + c.periods.length, 0)}, dogrulanan: ${cities.reduce((n, c) => n + c.periods.filter((p) => p.confirmed).length, 0)}`);
  for (const lang of ["en", "tr", "az"] as const) {
    console.log(`${lang}: kisi metni ${people.filter((p) => p.i18n[lang]?.description).length}, sehir ozeti ${cities.filter((c) => c.i18n[lang]?.summary).length}, sehir adi ${cities.filter((c) => c.i18n[lang]?.name).length}`);
  }
  const unknown = cities.flatMap((c) => c.rulers.filter((r) => !r.name).map((r) => `${c.id} ${r.from}`));
  console.log(`Yoneticisi bulunamayan donem: ${unknown.length}`, unknown.slice(0, 15).join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
