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
import { citySchema, personSchema, type City, type HistoricalEvent, type Person, type Source } from "../src/lib/types";
import { applyRulerOverrides, mergeRulers, periodConfirmed, rulerAt, type AreaFeature } from "./geo-utils";
import { cachedSparql, fetchExtracts, root, seedDir, wikiUri, wikiUrl, type Binding } from "./wikidata-client";
import { parseWktPoint, trimToSentence, wikidataTimeToYear } from "./wikidata-utils";

const LAST_YEAR = 1950;
const accessed = new Date().toISOString().slice(0, 10);
const readJson = <T>(...path: string[]) => JSON.parse(readFileSync(join(root, ...path), "utf8")) as T;
const qidOf = (b: Binding, key = "item") => b[key]?.value.split("/").pop() ?? null;

const LABELS = `
  OPTIONAL { ?item rdfs:label ?trLabel FILTER(LANG(?trLabel) = "tr") }
  OPTIONAL { ?item rdfs:label ?enLabel FILTER(LANG(?enLabel) = "en") }
  OPTIONAL { ?trWiki schema:about ?item; schema:isPartOf <https://tr.wikipedia.org/>; schema:name ?trTitle }`;

function wikiSources(ownerId: string, qid: string | null, title: string, trTitle: string | undefined, enTitle: string): Source[] {
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
  if (qid) out.push({ ...common, id: `${ownerId}-wikidata`, title, publisher: "Wikidata", url: `https://www.wikidata.org/wiki/${qid}` });
  if (trTitle) out.push({ ...common, id: `${ownerId}-trwiki`, title: trTitle, publisher: "Vikipedi", url: wikiUrl("tr", trTitle) });
  else out.push({ ...common, id: `${ownerId}-enwiki`, title: enTitle, publisher: "Wikipedia", url: wikiUrl("en", enTitle) });
  return out;
}

const placeOf = (name: { value: string } | undefined, coord: { value: string } | undefined) => {
  const point = coord ? parseWktPoint(coord.value) : null;
  return name && point ? { name: name.value, lng: point[0], lat: point[1] } : null;
};

async function buildPeople(events: HistoricalEvent[]): Promise<Person[]> {
  const list = readJson<{ id: string; enwiki: string }[]>("data", "manual", "people.json");
  const manualLinks = readJson<Record<string, string[]>>("data", "manual", "person-events.json");
  const eventIds = new Set(events.map((e) => e.id));
  const byTitle = new Map(events.map((e) => [e.title, e.id]));

  const people: Person[] = [];
  const titles: { id: string; tr?: string; en: string }[] = [];
  const base = new Map<string, { b: Binding; links: Set<string> }>();
  for (const p of list) {
    const found = await cachedSparql(
      `person2-${p.id}`,
      `SELECT ?item ?trLabel ?enLabel ?trTitle ?birth ?death ?human ?img ?birthName ?birthCoord ?deathName ?deathCoord WHERE {
        ${wikiUri(p.enwiki)} schema:about ?item.
        ${LABELS}
        OPTIONAL { ?item wdt:P569 ?birth }
        OPTIONAL { ?item wdt:P570 ?death }
        OPTIONAL { ?item wdt:P18 ?img }
        OPTIONAL { ?item wdt:P31 wd:Q5. BIND(1 AS ?human) }
        OPTIONAL { ?item wdt:P19 ?bp. ?bp wdt:P625 ?birthCoord. ?bp rdfs:label ?birthName FILTER(LANG(?birthName) = "tr") }
        OPTIONAL { ?item wdt:P20 ?dp. ?dp wdt:P625 ?deathCoord. ?dp rdfs:label ?deathName FILTER(LANG(?deathName) = "tr") }
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
    base.set(p.id, { b, links: new Set(linkRows.map((r) => qidOf(r, "e") ?? "").filter((e) => eventIds.has(e))) });
    titles.push({ id: p.id, tr: b.trTitle?.value, en: p.enwiki });
  }

  const tr = await fetchExtracts("tr", titles.flatMap((t) => (t.tr ? [t.tr] : [])));
  const en = await fetchExtracts("en", titles.flatMap((t) => (t.tr && tr.has(t.tr) ? [] : [t.en])));

  for (const p of list) {
    const entry = base.get(p.id);
    if (!entry) continue;
    const { b, links } = entry;
    const qid = qidOf(b);
    const trText = b.trTitle ? tr.get(b.trTitle.value) : undefined;
    const enText = en.get(p.enwiki);
    const text = trText ?? enText ?? "";
    const contentLang = trText ? "tr" : enText ? "en" : "tr";
    const name = b.trLabel?.value ?? b.trTitle?.value ?? b.enLabel?.value ?? p.enwiki;

    const manual = (manualLinks[p.id] ?? []).flatMap((title) => {
      const id = byTitle.get(title);
      if (!id) console.warn(`BAGLANTI BULUNAMADI ${p.id}: ${title}`);
      return id && !links.has(id) ? [id] : [];
    });
    const eventLinks = [...[...links].map((event_id) => ({ event_id, manual: false })), ...manual.map((event_id) => ({ event_id, manual: true }))];

    people.push({
      id: p.id,
      name,
      birth_year: b.birth ? wikidataTimeToYear(b.birth.value) : null,
      death_year: b.death ? wikidataTimeToYear(b.death.value) : null,
      wikidata_id: qid,
      summary: trimToSentence(text, 240),
      description: trimToSentence(text, 1400),
      image_url: b.img ? `${b.img.value.replace(/^http:/, "https:")}?width=480` : null,
      content_lang: contentLang,
      birth_place: placeOf(b.birthName, b.birthCoord),
      death_place: placeOf(b.deathName, b.deathCoord),
      events: eventLinks,
      sources: wikiSources(p.id, qid, name, b.trTitle?.value, p.enwiki),
      needs_review: contentLang !== "tr" || !text || manual.length > 0,
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

async function buildCities(): Promise<City[]> {
  const list = readJson<ManualCity[]>("data", "manual", "cities.json");
  const overrides = readJson<Record<string, { from: number; to: number; name: string }[]>>("data", "manual", "ruler-overrides.json");
  const manifest = readJson<{ year: number; file: string }[]>("public", "data", "boundaries", "manifest.json");
  const maps = manifest.map((m) => ({
    year: m.year,
    features: readJson<{ features: AreaFeature[] }>("public", "data", "boundaries", m.file).features,
  }));

  const cities: City[] = [];
  const found = new Map<string, Binding>();
  for (const c of list) {
    const rows = await cachedSparql(
      `city-${c.id}`,
      `SELECT ?item ?trTitle ?coord WHERE { ${wikiUri(c.enwiki)} schema:about ?item. ${LABELS} ?item wdt:P625 ?coord. } LIMIT 1`,
    );
    if (!rows[0]) {
      console.warn(`SEHIR BULUNAMADI: ${c.enwiki}`);
      continue;
    }
    found.set(c.id, rows[0]);
  }
  const live = list.filter((c) => found.has(c.id));
  const tr = await fetchExtracts("tr", live.flatMap((c) => (found.get(c.id)?.trTitle ? [found.get(c.id)?.trTitle?.value as string] : [])));
  const en = await fetchExtracts("en", live.flatMap((c) => (found.get(c.id)?.trTitle && tr.has(found.get(c.id)?.trTitle?.value as string) ? [] : [c.enwiki])));

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
    const trTitle = b.trTitle?.value;
    const trText = trTitle ? tr.get(trTitle) : undefined;
    const text = trText ?? en.get(c.enwiki) ?? "";
    const rulers = applyRulerOverrides(
      mergeRulers(
        maps.map((m) => ({ year: m.year, name: rulerAt(point, m.features) })),
        LAST_YEAR,
      ),
      overrides[c.id] ?? [],
    );
    cities.push({
      id: c.id,
      name: c.name,
      wikidata_id: qid,
      lng: point[0],
      lat: point[1],
      summary: trimToSentence(text, 320),
      content_lang: trText ? "tr" : "en",
      periods,
      other_names: c.other_names,
      rulers,
      sources: wikiSources(c.id, qid, c.name, trTitle, c.enwiki),
      // Ruler lists are always approximate, so that warning is shown separately on every city.
      needs_review: !trText || periods.some((p) => !p.confirmed) || c.other_names.length > 0,
    });
  }
  return cities;
}

async function main() {
  const events = readJson<HistoricalEvent[]>("data", "seed", "events.json");
  const people = (await buildPeople(events)).map((p) => personSchema.parse(p));
  writeFileSync(join(seedDir, "people.json"), `${JSON.stringify(people, null, 1)}\n`);
  const cities = (await buildCities()).map((c) => citySchema.parse(c));
  writeFileSync(join(seedDir, "cities.json"), `${JSON.stringify(cities, null, 1)}\n`);

  console.log(`Kisi: ${people.length}, baglanti: ${people.reduce((n, p) => n + p.events.length, 0)}`);
  console.log(`Sehir: ${cities.length}, ad donemi: ${cities.reduce((n, c) => n + c.periods.length, 0)}, dogrulanan: ${cities.reduce((n, c) => n + c.periods.filter((p) => p.confirmed).length, 0)}`);
  const unknown = cities.flatMap((c) => c.rulers.filter((r) => !r.name).map((r) => `${c.name} ${r.from}`));
  console.log(`Yoneticisi bulunamayan donem: ${unknown.length}`, unknown.slice(0, 15).join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
