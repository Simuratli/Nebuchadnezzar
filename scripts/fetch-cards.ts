/**
 * Builds data/seed/event-cards.json: parties, commanders, result, place and signatories
 * of wars, treaties and uprisings. Needs data/seed/events.json and sources.json.
 *
 *   npm run data:cards
 *
 * Structured fields come from Wikidata; commanders, sides and results come from English
 * Wikipedia infoboxes, which Wikidata rarely covers. Anything absent stays absent. Treaty
 * articles are not available in either, so the card has no field for them.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eventCardStoreSchema, type NameI18n, type Source, type StoredCard, type StoredEvent } from "../src/lib/types";
import { cleanResult, extractInfobox, readSides, type InfoboxFields } from "./infobox";
import { cachedSparql, diskMap, getJson, root, seedDir, sleep, wikiUri, type Binding } from "./wikidata-client";

const CARD_CATEGORIES = new Set(["savas", "antlasma", "isyan"]);
const readSeed = <T>(file: string) => JSON.parse(readFileSync(join(root, "data", "seed", file), "utf8")) as T;

type RevisionResponse = {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: { title: string; revisions?: { slots?: { main?: { content?: string } } }[] }[];
  };
};

/** Downloads page wikitext in small batches and keeps only the infobox fields. */
async function fetchInfoboxes(titles: string[]): Promise<Record<string, InfoboxFields | null>> {
  const cache = diskMap<InfoboxFields | null>("infobox-en.json");
  const todo = titles.filter((t) => cache.data[t] === undefined);
  for (let i = 0; i < todo.length; i += 25) {
    const batch = todo.slice(i, i + 25);
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=revisions&rvprop=content&rvslots=main&redirects=1&maxlag=5&titles=${encodeURIComponent(batch.join("|"))}`;
    let q = (await getJson<RevisionResponse>(url)).query;
    for (let tries = 0; !q && tries < 4; tries++) {
      await sleep(15_000 * (tries + 1));
      q = (await getJson<RevisionResponse>(url)).query;
    }
    if (!q) throw new Error(`no result for infobox batch at ${i}`);
    const byTitle = new Map((q.pages ?? []).map((p) => [p.title, p.revisions?.[0]?.slots?.main?.content]));
    for (const t of batch) {
      let cur = t;
      for (const n of q.normalized ?? []) if (n.from === cur) cur = n.to;
      for (const r of q.redirects ?? []) if (r.from === cur) cur = r.to;
      const text = byTitle.get(cur);
      cache.data[t] = text ? extractInfobox(text) : null;
    }
    cache.save();
    console.log(`bilgi kutusu: ${Math.min(i + 25, todo.length)}/${todo.length}`);
    await sleep(2000);
  }
  return cache.data;
}

const nameFrom = (en?: string, tr?: string, az?: string, qid?: string | null): NameI18n => ({
  ...(en && { en }),
  ...(tr && { tr }),
  ...(az && { az }),
  ...(qid && { qid }),
});

/** Turns linked article titles into names in every language, using their Wikidata items. */
async function resolveTitles(titles: string[]): Promise<Record<string, NameI18n>> {
  const cache = diskMap<NameI18n>("title-names.json");
  const todo = [...new Set(titles)].filter((t) => cache.data[t] === undefined);
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    const rows = await cachedSparql(
      `titles-${batch[0].replace(/[^\w-]/g, "_").slice(0, 40)}-${batch.length}`,
      `SELECT ?art ?item ?en ?tr ?az WHERE {
        VALUES ?art { ${batch.map(wikiUri).join(" ")} }
        ?art schema:about ?item.
        OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
        OPTIONAL { ?item rdfs:label ?tr FILTER(LANG(?tr) = "tr") }
        OPTIONAL { ?item rdfs:label ?az FILTER(LANG(?az) = "az") }
      }`,
    );
    const byUri = new Map(rows.map((r) => [r.art?.value, r]));
    for (const t of batch) {
      const r = byUri.get(wikiUri(t).slice(1, -1));
      // A link can point at a redirect, which has no item; the title itself is still the name.
      cache.data[t] = r ? nameFrom(r.en?.value ?? t, r.tr?.value, r.az?.value, r.item?.value.split("/").pop()) : nameFrom(t);
    }
    cache.save();
    console.log(`adlar: ${Math.min(i + 50, todo.length)}/${todo.length}`);
  }
  return cache.data;
}

const PROPS = { P710: "parties", P361: "part_of", P276: "places", P1891: "signatories" } as const;

async function fetchClaims(ids: string[]): Promise<Map<string, Binding[]>> {
  const out = new Map<string, Binding[]>();
  for (let i = 0; i < ids.length; i += 60) {
    const batch = ids.slice(i, i + 60);
    const rows = await cachedSparql(
      `card-claims-${i}-${batch.length}`,
      `SELECT ?item ?prop ?o ?en ?tr ?az WHERE {
        VALUES ?item { ${batch.map((q) => `wd:${q}`).join(" ")} }
        VALUES ?prop { ${Object.keys(PROPS).map((p) => `wdt:${p}`).join(" ")} }
        ?item ?prop ?o.
        FILTER(isIRI(?o))
        OPTIONAL { ?o rdfs:label ?en FILTER(LANG(?en) = "en") }
        OPTIONAL { ?o rdfs:label ?tr FILTER(LANG(?tr) = "tr") }
        OPTIONAL { ?o rdfs:label ?az FILTER(LANG(?az) = "az") }
      }`,
    );
    for (const r of rows) {
      const id = r.item?.value.split("/").pop() as string;
      out.set(id, [...(out.get(id) ?? []), r]);
    }
    console.log(`wikidata: ${Math.min(i + 60, ids.length)}/${ids.length}`);
  }
  return out;
}

async function main() {
  const events = readSeed<StoredEvent[]>("events.json").filter((e) => CARD_CATEGORIES.has(e.category));
  const sources = readSeed<Source[]>("sources.json");
  const articleOf = new Map(sources.filter((s) => s.lang === "en" && s.title).map((s) => [s.event_id, s.title as string]));

  const claims = await fetchClaims(events.map((e) => e.id));
  const infoboxes = await fetchInfoboxes(events.flatMap((e) => articleOf.get(e.id) ?? []));

  const sidesById = new Map(events.map((e) => {
    const title = articleOf.get(e.id);
    const fields = title ? infoboxes[title] : null;
    return [e.id, fields ? { sides: readSides(fields), result: cleanResult(fields.result) } : { sides: [], result: null }];
  }));
  const names = await resolveTitles([...sidesById.values()].flatMap((v) => v.sides.flatMap((s) => [...s.parties, ...s.commanders])));

  const cards: Record<string, StoredCard> = {};
  for (const e of events) {
    const grouped: Record<string, NameI18n[]> = { parties: [], part_of: [], places: [], signatories: [] };
    for (const r of claims.get(e.id) ?? []) {
      const key = PROPS[r.prop?.value.split("/").pop() as keyof typeof PROPS];
      const qid = r.o?.value.split("/").pop();
      if (!key || !qid || !r.en?.value || grouped[key].some((n) => n.qid === qid)) continue;
      grouped[key].push(nameFrom(r.en.value, r.tr?.value, r.az?.value, qid));
    }
    const box = sidesById.get(e.id) ?? { sides: [], result: null };
    const sides = box.sides.map((s) => ({ parties: s.parties.map((t) => names[t]), commanders: s.commanders.map((t) => names[t]) }));
    const card: StoredCard = { ...grouped, sides, result: box.result } as StoredCard;
    const filled = sides.length || box.result || Object.values(grouped).some((v) => v.length);
    if (filled) cards[e.id] = card;
  }
  const parsed = eventCardStoreSchema.parse(cards);
  writeFileSync(join(seedDir, "event-cards.json"), `${JSON.stringify(parsed, null, 1)}\n`);

  const all = Object.values(parsed);
  const inCat = (c: string) => events.filter((e) => e.category === c).map((e) => parsed[e.id]).filter(Boolean);
  console.log(`Kart: ${all.length}/${events.length}`);
  for (const c of CARD_CATEGORIES) {
    const list = inCat(c);
    console.log(
      `${c}: kart ${list.length}, taraf ${list.filter((x) => x.sides.some((s) => s.parties.length) || x.parties.length).length}, komutan ${list.filter((x) => x.sides.some((s) => s.commanders.length)).length}, sonuc ${list.filter((x) => x.result).length}, imzaci ${list.filter((x) => x.signatories.length).length}, yer ${list.filter((x) => x.places.length).length}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
