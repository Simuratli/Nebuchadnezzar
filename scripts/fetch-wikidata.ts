/**
 * Builds data/seed/{events,sources,people}.json from Wikidata and Wikipedia.
 *
 *   npm run data:wikidata
 *
 * Nothing is invented: a missing field stays empty and the record gets
 * needs_review=true. Routes and tours are hand-written in data/seed and are not
 * touched. Wikipedia intro text is CC BY-SA; each event cites its article.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  eventSchema,
  personSchema,
  sourceSchema,
  type Category,
  type HistoricalEvent,
  type Person,
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

const UA = "ZamanAtlasi/0.1 (historical map project; data preparation script)";
const SPARQL = "https://query.wikidata.org/sparql";
const MIN_YEAR = -500;
const MAX_YEAR = 1950;
// Sitelink counts favour big modern cities, so each century has a quota per category.
const CENTURY_CAPS: Record<Category, number> = { savas: 14, kurulus: 5, kultur: 5, bilim: 3, antlasma: 4, isyan: 4, goc: 2, diger: 0 };
const DELAY_MS = 1500;
const GRID: Record<string, [number, number]> = { osmanli: [3, 3], "ipek-yolu": [3, 1] };

const root = resolve(import.meta.dirname, "..");
const seedDir = join(root, "data", "seed");
const cacheDir = join(root, ".cache", "wikidata");
const accessed = new Date().toISOString().slice(0, 10);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sequential GET that retries transient errors, honouring Retry-After. */
async function getJson<T>(url: string, attempt = 0): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/sparql-results+json, application/json" },
  });
  if ([429, 500, 502, 503, 504].includes(res.status) && attempt < 5) {
    const wait = Number(res.headers.get("retry-after")) || 15 * (attempt + 1);
    console.warn(`  HTTP ${res.status}, waiting ${wait}s`);
    await sleep(wait * 1000);
    return getJson<T>(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${url.slice(0, 120)}: HTTP ${res.status}`);
  try {
    return (await res.json()) as T;
  } catch (e) {
    // WDQS streams results, so a server-side timeout arrives as HTTP 200 with truncated JSON.
    if (attempt >= 3) throw e;
    console.warn("  yanit yarim kaldi, yeniden deneniyor");
    await sleep(10_000 * (attempt + 1));
    return getJson<T>(url, attempt + 1);
  }
}

type Binding = Record<string, { value: string } | undefined>;
async function sparql(query: string): Promise<Binding[]> {
  const data = await getJson<{ results: { bindings: Binding[] } }>(`${SPARQL}?query=${encodeURIComponent(query)}`);
  await sleep(DELAY_MS);
  return data.results.bindings;
}

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

/** JSON map persisted on disk, so reruns only ask for what is new. */
function diskMap<T>(name: string) {
  const file = join(cacheDir, name);
  const data: Record<string, T> = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, T>) : {};
  return { data, save: () => writeFileSync(file, JSON.stringify(data)) };
}

type Enrichment = Pick<Raw, "labels" | "desc" | "trTitle" | "enTitle" | "image">;

const enrichmentOf = (b: Binding): Enrichment => ({
  labels: { tr: b.trLabel?.value, az: b.azLabel?.value, en: b.enLabel?.value },
  desc: { tr: b.trDesc?.value, en: b.enDesc?.value },
  trTitle: b.trTitle?.value,
  enTitle: b.enTitle?.value,
  image: b.img?.value,
});

/** Adds labels, descriptions, article titles and images to the selected items. */
async function enrich(items: Raw[]): Promise<void> {
  const cache = diskMap<Enrichment>("enrich.json");
  const todo = items.filter((r) => !cache.data[r.qid]);
  for (let i = 0; i < todo.length; i += 60) {
    const batch = todo.slice(i, i + 60);
    const rows = await sparql(`SELECT ?item ?trLabel ?azLabel ?enLabel ?trDesc ?enDesc ?trTitle ?enTitle ?img WHERE {
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
  desc: { tr?: string; en?: string };
  trTitle?: string;
  enTitle?: string;
  image?: string;
  links: number;
  /** From data/manual/key-events.json. */
  line?: [number, number][];
  regions?: HistoricalEvent["region_tags"];
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

/** Query results are cached on disk so a timeout late in the run does not lose earlier work. */
async function cachedSparql(key: string, query: string): Promise<Binding[]> {
  const file = join(cacheDir, `${key}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as Binding[];
  const rows = await sparql(query);
  writeFileSync(file, JSON.stringify(rows));
  return rows;
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

type ExtractResponse = {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: Record<string, { title: string; extract?: string }>;
  };
};

/** Fetches lead sections in batches of 20 (the API limit for exintro). */
async function fetchExtracts(lang: "tr" | "en", titles: string[]): Promise<Map<string, string>> {
  const cache = diskMap<string>(`extracts-${lang}.json`);
  const todo = titles.filter((t) => cache.data[t] === undefined);
  for (let i = 0; i < todo.length; i += 20) {
    const batch = todo.slice(i, i + 20);
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&exlimit=20&redirects=1&maxlag=5&titles=${encodeURIComponent(batch.join("|"))}`;
    const q = (await getJson<ExtractResponse>(url)).query;
    const byTitle = new Map(Object.values(q?.pages ?? {}).map((p) => [p.title, p.extract]));
    for (const t of batch) {
      let cur = t;
      for (const n of q?.normalized ?? []) if (n.from === cur) cur = n.to;
      for (const r of q?.redirects ?? []) if (r.from === cur) cur = r.to;
      cache.data[t] = byTitle.get(cur) ?? "";
    }
    cache.save();
    await sleep(300);
  }
  return new Map(titles.filter((t) => cache.data[t]).map((t) => [t, cache.data[t]]));
}

type KeyEvent = {
  enwiki: string;
  category: Category;
  start_year: number;
  end_year: number | null;
  point?: [number, number];
  line?: [number, number][];
  regions?: HistoricalEvent["region_tags"];
};

const wikiUri = (title: string) => `<https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_")).replace(/%3A/g, ":")}>`;

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

function toEvent(
  r: Raw,
  regions: HistoricalEvent["region_tags"],
  extract: { text: string; lang: string } | undefined,
): HistoricalEvent {
  const line = r.line;
  // The Turkish article title is usually a more established name than the item label.
  const title = r.trTitle ?? r.labels.tr ?? r.labels.az ?? r.labels.en ?? r.enTitle ?? r.qid;
  const titleLang = r.labels.tr || r.trTitle ? "tr" : r.labels.az ? "az" : "en";
  const summary = extract ? trimToSentence(extract.text, 240) : (r.desc.tr ?? r.desc.en ?? "");
  const textLang = extract?.lang ?? (r.desc.tr ? "tr" : r.desc.en ? "en" : titleLang);
  return {
    id: r.qid,
    title,
    summary,
    description: extract ? trimToSentence(extract.text, 1400) : "",
    start_year: r.start_year,
    end_year: r.end_year,
    date_precision: r.date_precision ?? "year",
    geometry: line ? { type: "LineString", coordinates: line } : { type: "Point", coordinates: r.coordinates },
    category: r.category,
    region_tags: regions,
    wikidata_id: r.qid,
    image_url: r.image ? `${r.image.replace(/^http:/, "https:")}?width=640` : null,
    content_lang: textLang === "tr" ? titleLang : textLang,
    // Hand-placed data, non-Turkish text and an empty summary all need a human eye. So do
    // Wikidata inception dates, which often record a refoundation or first mention.
    needs_review: Boolean(line) || Boolean(r.handPlaced) || r.dateProp === "P571" || titleLang !== "tr" || textLang !== "tr" || !summary,
  };
}

function toSources(r: Raw, title: string): Source[] {
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
  const wikiUrl = (lang: string, t: string) => `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(t.replaceAll(" ", "_"))}`;
  const out: Source[] = [
    { ...common, id: `${r.qid}-wikidata`, title, publisher: "Wikidata", url: `https://www.wikidata.org/wiki/${r.qid}` },
  ];
  if (r.trTitle) out.push({ ...common, id: `${r.qid}-trwiki`, title: r.trTitle, publisher: "Vikipedi", url: wikiUrl("tr", r.trTitle) });
  else if (r.enTitle) out.push({ ...common, id: `${r.qid}-enwiki`, title: r.enTitle, publisher: "Wikipedia", url: wikiUrl("en", r.enTitle) });
  return out;
}

async function fetchPeople(): Promise<Person[]> {
  const list = JSON.parse(readFileSync(join(root, "data", "manual", "people.json"), "utf8")) as { id: string; enwiki: string }[];
  const out: Person[] = [];
  for (const p of list) {
    const rows = await cachedSparql(
      `person-${p.id}`,
      `SELECT ?item ?trLabel ?enLabel ?birth ?death ?human WHERE {
        ${wikiUri(p.enwiki)} schema:about ?item.
        OPTIONAL { ?item rdfs:label ?trLabel FILTER(LANG(?trLabel) = "tr") }
        OPTIONAL { ?item rdfs:label ?enLabel FILTER(LANG(?enLabel) = "en") }
        OPTIONAL { ?item wdt:P569 ?birth }
        OPTIONAL { ?item wdt:P570 ?death }
        OPTIONAL { ?item wdt:P31 wd:Q5. BIND(1 AS ?human) }
      } LIMIT 1`,
    );
    const b = rows[0];
    if (!b?.human) {
      console.warn(`KISI ATLANDI: ${p.enwiki}`);
      continue;
    }
    out.push({
      id: p.id,
      name: b.trLabel?.value ?? b.enLabel?.value ?? p.enwiki,
      birth_year: b.birth ? wikidataTimeToYear(b.birth.value) : null,
      death_year: b.death ? wikidataTimeToYear(b.death.value) : null,
      wikidata_id: b.item?.value.split("/").pop() ?? null,
    });
  }
  return out;
}

async function main() {
  mkdirSync(seedDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });
  const people = (await fetchPeople()).map((p) => personSchema.parse(p));
  writeFileSync(join(seedDir, "people.json"), `${JSON.stringify(people, null, 1)}\n`);

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
  await enrich(chosen);

  const selected = [...chosen, ...keyEvents];
  const tr = await fetchExtracts("tr", selected.flatMap((r) => (r.trTitle ? [r.trTitle] : [])));
  const en = await fetchExtracts("en", selected.flatMap((r) => (r.enTitle && !(r.trTitle && tr.has(r.trTitle)) ? [r.enTitle] : [])));

  const events: HistoricalEvent[] = [];
  const sources: Source[] = [];
  for (const r of selected) {
    const trText = r.trTitle ? tr.get(r.trTitle) : undefined;
    const enText = r.enTitle ? en.get(r.enTitle) : undefined;
    const extract = trText ? { text: trText, lang: "tr" } : enText ? { text: enText, lang: "en" } : undefined;
    const regions = r.regions ?? ([...new Set((r.line ?? [r.coordinates]).flatMap((c) => regionsForPoint(c)))] as HistoricalEvent["region_tags"]);
    if (regions.length === 0) {
      console.warn(`BOLGE YOK, atlaniyor: ${r.enTitle ?? r.qid}`);
      continue;
    }
    const ev = eventSchema.parse(toEvent(r, regions, extract));
    events.push(ev);
    sources.push(...toSources(r, ev.title).map((s) => sourceSchema.parse(s)));
  }
  events.sort((a, b) => a.start_year - b.start_year);

  writeFileSync(join(seedDir, "events.json"), `${JSON.stringify(events, null, 1)}\n`);
  writeFileSync(join(seedDir, "sources.json"), `${JSON.stringify(sources, null, 1)}\n`);

  const count = (f: (e: HistoricalEvent) => string[]) => {
    const m: Record<string, number> = {};
    for (const e of events) for (const k of f(e)) m[k] = (m[k] ?? 0) + 1;
    return m;
  };
  console.log(`Olay: ${events.length}, kaynak: ${sources.length}, kisi: ${people.length}`);
  console.log("Kategori:", JSON.stringify(count((e) => [e.category])));
  console.log("Bolge:", JSON.stringify(count((e) => e.region_tags)));
  console.log("Turkce:", events.filter((e) => e.content_lang === "tr").length, "| needs_review:", events.filter((e) => e.needs_review).length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
