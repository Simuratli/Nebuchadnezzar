/**
 * Builds data/seed/polities.json for the states timeline.
 *
 *   npm run data:polities
 *
 * Dates come from Wikidata (P571, P576). data/manual/polities.json supplies a date where
 * Wikidata has none, and "fix" overrides a value known to be misleading (such as a coarse
 * century stored as a year). Every hand-supplied date is marked, and so is its bar.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { polityStoreSchema, type StoredPolity } from "../src/lib/types";
import { cachedSparql, root, seedDir, wikiUri, wikiUrl } from "./wikidata-client";
import { wikidataTimeToYear } from "./wikidata-utils";

type Manual = {
  id: string;
  group: StoredPolity["group"];
  enwiki: string;
  from?: number;
  to?: number;
  fix?: ("from" | "to")[];
  names?: { tr?: string; az?: string };
};

async function main() {
  const list = JSON.parse(readFileSync(join(root, "data", "manual", "polities.json"), "utf8")) as Manual[];
  const out: StoredPolity[] = [];
  for (const p of list) {
    const rows = await cachedSparql(
      `polity-${p.enwiki.replace(/[^\w-]/g, "_")}`,
      `SELECT ?item ?start ?end ?en ?tr ?az WHERE {
        ${wikiUri(p.enwiki)} schema:about ?item.
        OPTIONAL { ?item wdt:P571 ?start }
        OPTIONAL { ?item wdt:P576 ?end }
        OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
        OPTIONAL { ?item rdfs:label ?tr FILTER(LANG(?tr) = "tr") }
        OPTIONAL { ?item rdfs:label ?az FILTER(LANG(?az) = "az") }
      }`,
    );
    if (!rows[0]) {
      console.warn(`BULUNAMADI: ${p.enwiki}`);
      continue;
    }
    const years = (key: "start" | "end") => rows.flatMap((r) => (r[key] ? [wikidataTimeToYear(r[key]?.value ?? "")] : [])).filter((y): y is number => y !== null);
    const starts = years("start");
    const ends = years("end");
    const wdFrom = starts.length ? Math.min(...starts) : null;
    const wdTo = ends.length ? Math.max(...ends) : null;
    const useManualFrom = p.fix?.includes("from") || wdFrom === null;
    const useManualTo = p.fix?.includes("to") || wdTo === null;
    const from = useManualFrom ? (p.from ?? null) : wdFrom;
    const to = useManualTo ? (p.to ?? null) : wdTo;
    if (from === null) {
      console.warn(`BASLANGIC YOK: ${p.enwiki}`);
      continue;
    }
    const first = rows[0];
    out.push({
      id: p.id,
      group: p.group,
      from,
      to,
      manual_dates: (useManualFrom && p.from !== undefined) || (useManualTo && p.to !== undefined),
      wikidata_id: first.item?.value.split("/").pop() ?? null,
      url: wikiUrl("en", p.enwiki),
      i18n: {
        en: first.en?.value ?? p.enwiki,
        ...((p.names?.tr ?? first.tr?.value) && { tr: p.names?.tr ?? first.tr?.value }),
        ...((p.names?.az ?? first.az?.value) && { az: p.names?.az ?? first.az?.value }),
      },
    });
  }
  const parsed = polityStoreSchema.parse(out);
  writeFileSync(join(seedDir, "polities.json"), `${JSON.stringify(parsed, null, 1)}\n`);
  console.log(`Devlet: ${parsed.length}, elle tarihli: ${parsed.filter((p) => p.manual_dates).length}, eksik ad tr: ${parsed.filter((p) => !p.i18n.tr).length}, az: ${parsed.filter((p) => !p.i18n.az).length}`);
  for (const p of parsed) console.log(`${p.id} ${p.from}..${p.to ?? "devam"}${p.manual_dates ? " (elle)" : ""}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
