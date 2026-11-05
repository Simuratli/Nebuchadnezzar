/**
 * Builds data/seed/{events,sources}.json from Wikidata and Wikipedia.
 * People and cities come from scripts/fetch-entities.ts, which reads this output.
 *
 *   npm run data:wikidata
 *
 * Nothing is invented: a missing field stays empty and the record gets
 * needs_review=true. Routes and tours are hand-written in data/seed and are not
 * touched. Wikipedia intro text is CC BY-SA; each event cites its article.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  storedEventSchema,
  sourceSchema,
  type Category,
  type Locale,
  type StoredEvent,
  type Source,
} from "../src/lib/types";
import {
  parseWktPoint,
  precisionToDate,
  regionsForPoint,
  REGION_BOXES,
  selectBalanced,
  splitBox,
  trimToSentence,
  wikidataTimeToYear,
} from "./wikidata-utils";
import {
  cacheDir,
  cachedSparql,
  diskMap,
  fetchExtracts,
  root,
  seedDir,
  sparql,
  wikiUri,
  WIKI_PUBLISHER,
  wikiUrl,
  type Binding,
} from "./wikidata-client";

const MIN_YEAR = -500;
const MAX_YEAR = 1950;
// Sitelink counts favour big modern cities, so each century has a quota per category.
const CENTURY_CAPS: Record<Category, number> = { savas: 14, kurulus: 5, kultur: 5, bilim: 3, antlasma: 4, isyan: 4, goc: 2, diger: 0 };
const GRID: Record<string, [number, number]> = { osmanli: [3, 3], "ipek-yolu": [3, 1] };

const accessed = new Date().toISOString().slice(0, 10);

type Group = { name: string; category: Category; types: string[]; dateProps: string[]; minLinks: number };
const GROUPS: Group[] = [
  { name: "savaşlar", category: "savas", types: ["Q178561", "Q188055", "Q198"], dateProps: ["P585", "P580"], minLinks: 1 },
  { name: "antlaşmalar", category: "antlasma", types: ["Q131569", "Q625298"], dateProps: ["P585", "P580"], minLinks: 1 },
  { name: "isyanlar", category: "isyan", types: ["Q124734", "Q10931"], dateProps: ["P585", "P580"], minLinks: 1 },
  { name: "kuruluşlar", category: "kurulus", types: ["Q515", "Q15661340", "Q1549591", "Q5119"], dateProps: ["P571"], minLinks: 8 },
  { name: "kültür", category: "kultur", types: ["Q32815", "Q16970", "Q2977", "Q186347"], dateProps: ["P571"], minLinks: 5 },
  { name: "bilim", category: "bilim", types: ["Q3918", "Q62832", "Q7075", "Q132834"], dateProps: ["P571"], minLinks: 4 },
];

const LABELS = `
  OPTIONAL { ?item rdfs:label ?trLabel FILTER(LANG(?trLabel) = "tr") }
  OPTIONAL { ?item rdfs:label ?azLabel FILTER(LANG(?azLabel) = "az") }
  OPTIONAL { ?item rdfs:label ?enLabel FILTER(LANG(?enLabel) = "en") }
  OPTIONAL { ?item schema:description ?trDesc FILTER(LANG(?trDesc) = "tr") }
  OPTIONAL { ?item schema:description ?enDesc FILTER(LANG(?enDesc) = "en") }
  OPTIONAL { ?item schema:description ?azDesc FILTER(LANG(?azDesc) = "az") }
  OPTIONAL { ?azWiki schema:about ?item; schema:isPartOf <https://az.wikipedia.org/>; schema:name ?azTitle }
  OPTIONAL { ?trWiki schema:about ?item; schema:isPartOf <https://tr.wikipedia.org/>; schema:name ?trTitle }
  OPTIONAL { ?enWiki schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?enTitle }
  OPTIONAL { ?item wdt:P18 ?img }
  OPTIONAL { ?item wikibase:sitelinks ?links }`;

/**
 * Candidate query: geography and best-rank dates only. Precision needs the much
 * slower statement-value path, so fetchPrecisions gets it in small batches.
 */
function buildQuery(g: Group, box: { south: number; west: number; north: number; east: number }, dateProp: string) {
  const end = dateProp === "P580" ? "OPTIONAL { ?item wdt:P582 ?end }" : "";
  return `SELECT ?item ?coord ?time ?end ?links WHERE {
  VALUES ?type { ${g.types.map((t) => `wd:${t}`).join(" ")} }
  ?item wdt:P31 ?type.
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord.
    bd:serviceParam wikibase:cornerSouthWest "Point(${box.west} ${box.south})"^^geo:wktLiteral.
    bd:serviceParam wikibase:cornerNorthEast "Point(${box.east} ${box.north})"^^geo:wktLiteral.
  }
  ?item wdt:${dateProp} ?time.
  ${end}
  ?item wikibase:sitelinks ?links.
  FILTER(?links >= ${g.minLinks})
}`;
}

/** Sets date_precision on each candidate; those coarser than a year remain null and are dropped. */
async function fetchPrecisions(items: Raw[]): Promise<void> {
  const file = join(cacheDir, "precision.json");
  const known: Record<string, number> = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, number>) : {};
  for (const prop of new Set(items.map((r) => r.dateProp))) {
    const todo = items.filter((r) => r.dateProp === prop && known[r.qid] === undefined);
    for (let i = 0; i < todo.length; i += 150) {
      const batch = todo.slice(i, i + 150);
      const rows = await sparql(`SELECT ?item ?prec WHERE {
        VALUES ?item { ${batch.map((r) => `wd:${r.qid}`).join(" ")} }
        ?item p:${prop} ?st. ?st a wikibase:BestRank; psv:${prop}/wikibase:timePrecision ?prec.
      }`);
      for (const r of batch) known[r.qid] ??= 0;
      for (const b of rows) {
        const qid = b.item?.value.split("/").pop();
        if (qid) known[qid] = Math.max(known[qid] ?? 0, Number(b.prec?.value ?? 0));
      }
      writeFileSync(file, JSON.stringify(known));
      console.log(`hassasiyet ${prop}: ${Math.min(i + 150, todo.length)}/${todo.length}`);
    }
  }
  for (const r of items) r.date_precision = precisionToDate(known[r.qid] ?? 0);
}

type Enrichment = Pick<Raw, "labels" | "desc" | "trTitle" | "enTitle" | "azTitle" | "image">;

const enrichmentOf = (b: Binding): Enrichment => ({
  labels: { tr: b.trLabel?.value, az: b.azLabel?.value, en: b.enLabel?.value },
  desc: { tr: b.trDesc?.value, en: b.enDesc?.value, az: b.azDesc?.value },
  trTitle: b.trTitle?.value,
  enTitle: b.enTitle?.value,
  azTitle: b.azTitle?.value,
  image: b.img?.value,
});

/** Adds labels, descriptions, article titles and images to the selected items. */
async function enrich(items: Raw[]): Promise<void> {
  const cache = diskMap<Enrichment>("enrich-3lang.json");
  const todo = items.filter((r) => !cache.data[r.qid]);
  for (let i = 0; i < todo.length; i += 60) {
    const batch = todo.slice(i, i + 60);
    const rows = await sparql(`SELECT ?item ?trLabel ?azLabel ?enLabel ?trDesc ?enDesc ?azDesc ?trTitle ?enTitle ?azTitle ?img WHERE {
      VALUES ?item { ${batch.map((r) => `wd:${r.qid}`).join(" ")} }
      ${LABELS}
    }`);
    const seen = new Set<string>();
    for (const b of rows) {
      const qid = b.item?.value.split("/").pop();
      // An item with several images returns several rows; the first one wins.
      if (qid && !seen.has(qid)) {
        seen.add(qid);
        cache.data[qid] = enrichmentOf(b);
      }
    }
    for (const r of batch) cache.data[r.qid] ??= { labels: {}, desc: {} };
    cache.save();
    console.log(`etiketler: ${Math.min(i + 60, todo.length)}/${todo.length}`);
  }
  for (const r of items) Object.assign(r, cache.data[r.qid]);
}

type Raw = {
  qid: string;
  category: Category;
  coordinates: [number, number];
  start_year: number;
  end_year: number | null;
  date_precision: "year" | "month" | "day" | null;
  dateProp: string;
  labels: { tr?: string; az?: string; en?: string };
  desc: { tr?: string; en?: string; az?: string };
  trTitle?: string;
  enTitle?: string;
  azTitle?: string;
  image?: string;
  links: number;
  /** From data/manual/key-events.json. */
  line?: [number, number][];
  regions?: StoredEvent["region_tags"];
  /** Coordinates or date could not be confirmed against Wikidata. */
  handPlaced?: boolean;
};

function parseRow(b: Binding, category: Category, dateProp: string): Raw | null {
  const qid = b.item?.value.split("/").pop();
  const coordinates = b.coord && parseWktPoint(b.coord.value);
  const start_year = b.time && wikidataTimeToYear(b.time.value);
  if (!qid || !coordinates || !start_year) return null;
  const endYear = b.end ? wikidataTimeToYear(b.end.value) : null;
  return {
    qid,
    category,
    coordinates,
    start_year,
    end_year: endYear && endYear > start_year ? endYear : null,
    date_precision: null,
    dateProp,
    labels: {},
    desc: {},
    links: Number(b.links?.value ?? 0),
  };
}

async function fetchCandidates(): Promise<Map<string, Raw>> {
  mkdirSync(cacheDir, { recursive: true });
  const all = new Map<string, Raw>();
  // The larger boxes time out as a single query, so they are split into a grid.
  const cells = Object.entries(REGION_BOXES).flatMap(([region, box]) => {
    const [nx, ny] = GRID[region] ?? [1, 1];
    return splitBox(box, nx, ny).map((cell, i) => ({ region: `${region}${i}`, box: cell }));
  });
  for (const g of GROUPS) {
    for (const { region, box } of cells) {
      for (const prop of g.dateProps) {
        let rows: Binding[];
        try {
          rows = await cachedSparql(`${g.category}-${region}-${prop}`, buildQuery(g, box, prop));
        } catch (e) {
          // One failed slice only thins the candidate pool; the summary shows the result.
          console.warn(`ATLANDI ${g.name} / ${region} / ${prop}: ${(e as Error).message}`);
          continue;
        }
        let added = 0;
        for (const row of rows) {
          const raw = parseRow(row, g.category, prop);
          if (!raw || raw.start_year < MIN_YEAR || raw.start_year > MAX_YEAR) continue;
          // Items with several dates are ambiguous: the first row wins, so
          // P585 (point in time) beats P580 (start time).
          if (!all.has(raw.qid)) {
            all.set(raw.qid, raw);
            added++;
          }
        }
        console.log(`${g.name} / ${region} / ${prop}: ${rows.length} satir, ${added} yeni`);
      }
    }
  }
  return all;
}

type KeyEvent = {
  enwiki: string;
  category: Category;
  start_year: number;
  end_year: number | null;
  point?: [number, number];
  line?: [number, number][];
  regions?: StoredEvent["region_tags"];
};

/**
 * Curated events that the area queries miss, usually because Wikidata has no
 * coordinates for them. The curated year is used and compared with Wikidata; a
 * disagreement is logged and any unconfirmed date or position is flagged for review.
 */
async function fetchKeyEvents(): Promise<Raw[]> {
  const list = JSON.parse(readFileSync(join(root, "data", "manual", "key-events.json"), "utf8")) as KeyEvent[];
  const out: Raw[] = [];
  for (const k of list) {
    let rows: Binding[];
    try {
      rows = await cachedSparql(
        `key-${k.enwiki.replace(/[^\w-]/g, "_")}`,
        `SELECT ?item ?trLabel ?azLabel ?enLabel ?trDesc ?enDesc ?trTitle ?enTitle ?img ?links ?coord ?p585 ?p580 ?p571 WHERE {
          ${wikiUri(k.enwiki)} schema:about ?item.
          ${LABELS}
          OPTIONAL { ?item wdt:P625 ?coord }
          OPTIONAL { ?item wdt:P585 ?p585 }
          OPTIONAL { ?item wdt:P580 ?p580 }
          OPTIONAL { ?item wdt:P571 ?p571 }
        } LIMIT 1`,
      );
    } catch (e) {
      console.warn(`ANAHTAR OLAY ATLANDI ${k.enwiki}: ${(e as Error).message}`);
      continue;
    }
    const b = rows[0];
    const qid = b?.item?.value.split("/").pop();
    if (!b || !qid) {
      console.warn(`ANAHTAR OLAY BULUNAMADI: ${k.enwiki}`);
      continue;
    }
    const wdTime = b.p585?.value ?? b.p580?.value ?? b.p571?.value;
    const wdYear = wdTime ? wikidataTimeToYear(wdTime) : null;
    const dateConfirmed = wdYear !== null && Math.abs(wdYear - k.start_year) <= 1;
    if (wdYear !== null && !dateConfirmed) console.warn(`TARIH UYUSMAZLIGI ${k.enwiki}: elle ${k.start_year}, Wikidata ${wdYear}`);
    const wdPoint = b.coord ? parseWktPoint(b.coord.value) : null;
    const coordinates = k.line ? k.line[0] : (wdPoint ?? k.point);
    if (!coordinates) throw new Error(`${k.enwiki}: konum yok`);
    out.push({
      qid,
      category: k.category,
      coordinates,
      start_year: k.start_year,
      end_year: k.end_year,
      date_precision: "year",
      dateProp: "manual",
      ...enrichmentOf(b),
      enTitle: b.enTitle?.value ?? k.enwiki,
      links: Number(b.links?.value ?? 0),
      line: k.line,
      regions: k.regions,
      handPlaced: !dateConfirmed || (!k.line && !wdPoint),
    });
  }
  return out;
}

const trimOrUndefined = (text: string | undefined, max: number) => (text ? trimToSentence(text, max) : undefined);

function toEvent(r: Raw, regions: StoredEvent["region_tags"], extracts: Record<Locale, string | undefined>): StoredEvent {
  const line = r.line;
  const titles: Record<Locale, string | undefined> = {
    en: r.enTitle ?? r.labels.en,
    // The Turkish article title is usually a more established name than the item label.
    tr: r.trTitle ?? r.labels.tr,
    az: r.azTitle ?? r.labels.az,
  };
  const i18n: StoredEvent["i18n"] = {};
  for (const lang of ["en", "tr", "az"] as const) {
    const summary = trimOrUndefined(extracts[lang], 240) ?? r.desc[lang];
    const description = trimOrUndefined(extracts[lang], 1400);
    if (titles[lang] || summary) i18n[lang] = { title: titles[lang], summary, description };
  }
  if (!Object.values(i18n).some((v) => v.title)) i18n.en = { ...i18n.en, title: r.qid };
  return {
    id: r.qid,
    start_year: r.start_year,
    end_year: r.end_year,
    date_precision: r.date_precision ?? "year",
    geometry: line ? { type: "LineString", coordinates: line } : { type: "Point", coordinates: r.coordinates },
    category: r.category,
    region_tags: regions,
    wikidata_id: r.qid,
    image_url: r.image ? `${r.image.replace(/^http:/, "https:")}?width=640` : null,
    i18n,
    // Hand-placed data and empty summaries need a human eye. So do Wikidata inception
    // dates, which often record a refoundation or first mention. Language is not a
    // review matter: the panel states it whenever the text is in another language.
    needs_review: Boolean(line) || Boolean(r.handPlaced) || r.dateProp === "P571" || !Object.values(i18n).some((v) => v.summary),
  };
}

function toSources(r: Raw): Source[] {
  const common = {
    event_id: r.qid,
    type: "ansiklopedi" as const,
    author: null,
    year: null, // wiki pages have no fixed publication year; accessed_at records when they were read
    pages: null,
    reliability: 1,
    accessed_at: accessed,
    needs_review: false,
  };
  // The Wikidata title is filled in per language when records are served.
  const out: Source[] = [{ ...common, id: `${r.qid}-wikidata`, title: null, publisher: "Wikidata", url: `https://www.wikidata.org/wiki/${r.qid}`, lang: null }];
  const articles: [Locale, string | undefined][] = [["en", r.enTitle], ["tr", r.trTitle], ["az", r.azTitle]];
  for (const [lang, title] of articles) {
    if (title) out.push({ ...common, id: `${r.qid}-${lang}wiki`, title, publisher: WIKI_PUBLISHER[lang], url: wikiUrl(lang, title), lang });
  }
  return out;
}

async function main() {
  mkdirSync(seedDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });
  const candidates = await fetchCandidates();
  console.log(`Toplam aday: ${candidates.size}`);
  await fetchPrecisions([...candidates.values()]);

  const excluded = new Set((JSON.parse(readFileSync(join(root, "data", "manual", "excluded.json"), "utf8")) as { id: string }[]).map((x) => x.id));
  const keyEvents = await fetchKeyEvents();
  const keyIds = new Set(keyEvents.map((k) => k.qid));

  const scored = [...candidates.values()]
    .filter((r) => r.date_precision !== null && !excluded.has(r.qid) && !keyIds.has(r.qid))
    .map((r) => ({
      raw: r,
      id: r.qid,
      category: r.category as string,
      start_year: r.start_year,
      region_tags: regionsForPoint(r.coordinates) as string[],
      score: r.links,
    }))
    .filter((c) => c.region_tags.length > 0);
  const chosen = selectBalanced(scored, CENTURY_CAPS).map((c) => c.raw);
  const selected = [...chosen, ...keyEvents];
  await enrich(selected);
  const titlesFor = (key: "trTitle" | "enTitle" | "azTitle") => selected.flatMap((r) => (r[key] ? [r[key] as string] : []));
  const tr = await fetchExtracts("tr", titlesFor("trTitle"));
  const en = await fetchExtracts("en", titlesFor("enTitle"));
  const az = await fetchExtracts("az", titlesFor("azTitle"));

  const events: StoredEvent[] = [];
  const sources: Source[] = [];
  for (const r of selected) {
    const extracts = {
      en: r.enTitle ? en.get(r.enTitle) : undefined,
      tr: r.trTitle ? tr.get(r.trTitle) : undefined,
      az: r.azTitle ? az.get(r.azTitle) : undefined,
    };
    const regions = r.regions ?? ([...new Set((r.line ?? [r.coordinates]).flatMap((c) => regionsForPoint(c)))] as StoredEvent["region_tags"]);
    if (regions.length === 0) {
      console.warn(`BOLGE YOK, atlaniyor: ${r.enTitle ?? r.qid}`);
      continue;
    }
    events.push(storedEventSchema.parse(toEvent(r, regions, extracts)));
    sources.push(...toSources(r).map((s) => sourceSchema.parse(s)));
  }
  events.sort((a, b) => a.start_year - b.start_year);

  writeFileSync(join(seedDir, "events.json"), `${JSON.stringify(events, null, 1)}\n`);
  writeFileSync(join(seedDir, "sources.json"), `${JSON.stringify(sources, null, 1)}\n`);

  const count = (f: (e: StoredEvent) => string[]) => {
    const m: Record<string, number> = {};
    for (const e of events) for (const k of f(e)) m[k] = (m[k] ?? 0) + 1;
    return m;
  };
  console.log(`Olay: ${events.length}, kaynak: ${sources.length}`);
  console.log("Kategori:", JSON.stringify(count((e) => [e.category])));
  console.log("Bolge:", JSON.stringify(count((e) => e.region_tags)));
  for (const lang of ["en", "tr", "az"] as const) {
    console.log(`${lang}: baslik ${events.filter((e) => e.i18n[lang]?.title).length}, ozet ${events.filter((e) => e.i18n[lang]?.summary).length}, metin ${events.filter((e) => e.i18n[lang]?.description).length}`);
  }
  console.log("needs_review:", events.filter((e) => e.needs_review).length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
