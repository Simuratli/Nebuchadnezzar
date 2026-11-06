/** Network and cache helpers shared by the Wikidata scripts. Run one script at a time. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const root = resolve(import.meta.dirname, "..");
export const seedDir = join(root, "data", "seed");
export const cacheDir = join(root, ".cache", "wikidata");

const UA = "Nebuchadnezzar/0.1 (historical map project; data preparation script)";
const SPARQL = "https://query.wikidata.org/sparql";
const DELAY_MS = 1500;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sequential GET that retries transient errors, honouring Retry-After. */
export async function getJson<T>(url: string, attempt = 0): Promise<T> {
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

export type Binding = Record<string, { value: string } | undefined>;

export async function sparql(query: string): Promise<Binding[]> {
  const data = await getJson<{ results: { bindings: Binding[] } }>(`${SPARQL}?query=${encodeURIComponent(query)}`);
  await sleep(DELAY_MS);
  return data.results.bindings;
}

/** Query results are cached on disk so a timeout late in the run does not lose earlier work. */
export async function cachedSparql(key: string, query: string): Promise<Binding[]> {
  mkdirSync(cacheDir, { recursive: true });
  const file = join(cacheDir, `${key}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as Binding[];
  const rows = await sparql(query);
  writeFileSync(file, JSON.stringify(rows));
  return rows;
}

/** JSON map persisted on disk, so reruns only ask for what is new. */
export function diskMap<T>(name: string) {
  mkdirSync(cacheDir, { recursive: true });
  const file = join(cacheDir, name);
  const data: Record<string, T> = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, T>) : {};
  return { data, save: () => writeFileSync(file, JSON.stringify(data)) };
}

export const wikiUri = (title: string) =>
  `<https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_")).replace(/%3A/g, ":").replace(/%2C/g, ",").replace(/'/g, "%27")}>`;

/** Publisher name for an article, as readers of that language know it. */
export const WIKI_PUBLISHER = { en: "Wikipedia", tr: "Vikipedi", az: "Vikipediya" } as const;

export const wikiUrl = (lang: string, title: string) => `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;

type ExtractResponse = {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: Record<string, { title: string; extract?: string }>;
  };
};

/** Fetches lead sections in batches of 20 (the API limit for exintro). */
export async function fetchExtracts(lang: "tr" | "en" | "az", titles: string[]): Promise<Map<string, string>> {
  const cache = diskMap<string>(`extracts-${lang}.json`);
  const todo = titles.filter((t) => cache.data[t] === undefined);
  for (let i = 0; i < todo.length; i += 20) {
    const batch = todo.slice(i, i + 20);
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&exlimit=20&redirects=1&maxlag=5&titles=${encodeURIComponent(batch.join("|"))}`;
    let q = (await getJson<ExtractResponse>(url)).query;
    // A maxlag or throttling reply has no query block; caching it would record empty texts.
    for (let tries = 0; !q && tries < 4; tries++) {
      await sleep(15_000 * (tries + 1));
      q = (await getJson<ExtractResponse>(url)).query;
    }
    if (!q) throw new Error(`${lang}.wikipedia: no result for batch at ${i}`);
    const byTitle = new Map(Object.values(q?.pages ?? {}).map((p) => [p.title, p.extract]));
    for (const t of batch) {
      let cur = t;
      for (const n of q?.normalized ?? []) if (n.from === cur) cur = n.to;
      for (const r of q?.redirects ?? []) if (r.from === cur) cur = r.to;
      cache.data[t] = byTitle.get(cur) ?? "";
    }
    cache.save();
    await sleep(1000);
  }
  return new Map(titles.filter((t) => cache.data[t]).map((t) => [t, cache.data[t]]));
}
