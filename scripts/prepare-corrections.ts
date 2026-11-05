/**
 * Builds the South Caucasus correction layer. historical-basemaps shows this region
 * wrongly for 1800-1920 (Persia until 1914, for one), so its polygons are cut out
 * there and replaced by groups of today's admin-1 units from Natural Earth (public
 * domain), dated by treaties in data/manual/south-caucasus.json.
 *
 *   npm run data:corrections     (run before data:boundaries, which erases the region)
 *
 * Today's units only approximate historical borders, so every record stays flagged.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { correctionSchema, sourceSchema, type Correction, type Source } from "../src/lib/types";

const NE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson";
const UA = "ZamanAtlasi/0.1 (historical map project; data preparation script)";
const root = resolve(import.meta.dirname, "..");
const cacheDir = join(root, ".cache", "natural-earth");
const outDir = join(root, "public", "data", "corrections");
const mapshaper = join(root, "node_modules", "mapshaper", "bin", "mapshaper");

type Input = {
  sources: Record<string, { title: string; url: string }>;
  groups: {
    id: string;
    units: Record<string, string[]>;
    slices: { from: number; to: number; name: string; color_key: string; note: string; sources: string[] }[];
  }[];
};

const run = (...args: string[]) => execFileSync(process.execPath, [mapshaper, ...args], { stdio: ["ignore", "ignore", "pipe"] });

async function main() {
  mkdirSync(cacheDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  const input = JSON.parse(readFileSync(join(root, "data", "manual", "south-caucasus.json"), "utf8")) as Input;

  const raw = join(cacheDir, "admin1.geojson");
  if (!existsSync(raw)) {
    const res = await fetch(NE_URL, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`Natural Earth: HTTP ${res.status}`);
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  }

  const subset = join(cacheDir, "subset.json");
  const admins = Object.keys(Object.assign({}, ...input.groups.map((g) => g.units)));
  run(raw, "-filter", `${JSON.stringify(admins)}.includes(admin)`, "-filter-fields", "name,admin", "-o", subset, "format=geojson", "force");

  const lookup = new Map<string, string>();
  for (const g of input.groups) {
    for (const [admin, names] of Object.entries(g.units)) {
      for (const name of names) {
        const key = `${admin}|${name}`;
        if (lookup.has(key)) throw new Error(`${key} is in two groups`);
        lookup.set(key, g.id);
      }
    }
  }

  const fc = JSON.parse(readFileSync(subset, "utf8")) as { type: string; features: { properties: { name: string; admin: string; group?: string } }[] };
  const seen = new Set<string>();
  fc.features = fc.features.filter((f) => {
    const key = `${f.properties.admin}|${f.properties.name}`;
    const group = lookup.get(key);
    if (!group) return false;
    seen.add(key);
    f.properties.group = group;
    return true;
  });
  const missing = [...lookup.keys()].filter((k) => !seen.has(k));
  if (missing.length) throw new Error(`Natural Earth has no: ${missing.join(", ")}`);
  // Azerbaijan is listed unit by unit, so a unit nobody claimed would leave a hole.
  const all = JSON.parse(readFileSync(subset, "utf8")) as typeof fc;
  const unclaimed = all.features.filter((f) => f.properties.admin === "Azerbaijan" && !lookup.has(`Azerbaijan|${f.properties.name}`)).map((f) => f.properties.name);
  if (unclaimed.length) throw new Error(`Azerbaijan units without a group: ${unclaimed.join(", ")}`);

  const grouped = join(cacheDir, "grouped.json");
  writeFileSync(grouped, JSON.stringify(fc));

  run(grouped, "-dissolve", "group", "-simplify", "dp", "interval=3km", "keep-shapes", "-o", join(outDir, "south-caucasus.json"), "format=geojson", "precision=0.01", "force");
  // The cut-out for the boundary files; see scripts/prepare-boundaries.ts.
  run(grouped, "-dissolve", "-o", join(cacheDir, "region.json"), "format=geojson", "precision=0.01", "force");

  const accessed = new Date().toISOString().slice(0, 10);
  const corrections: Correction[] = input.groups.map((g) =>
    correctionSchema.parse({
      id: g.id,
      needs_review: true,
      slices: g.slices.map((s) => ({
        from: s.from,
        to: s.to,
        name: s.name,
        color_key: s.color_key,
        note: s.note,
        sources: s.sources.map((key): Source => {
          const src = input.sources[key];
          if (!src) throw new Error(`unknown source ${key}`);
          return sourceSchema.parse({
            id: `fix-${g.id}-${s.from}-${key}`,
            event_id: g.id,
            type: "ansiklopedi",
            author: null,
            title: src.title,
            year: null,
            publisher: "Wikipedia",
            url: src.url,
            pages: null,
            reliability: 1,
            accessed_at: accessed,
            needs_review: true,
          });
        }),
      })),
    }),
  );
  writeFileSync(join(root, "data", "seed", "corrections.json"), `${JSON.stringify(corrections, null, 1)}\n`);
  console.log(`${corrections.length} grup, ${corrections.reduce((n, c) => n + c.slices.length, 0)} dönem`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
