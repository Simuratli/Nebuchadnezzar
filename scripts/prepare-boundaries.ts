/**
 * Downloads historical-basemaps GeoJSON for the app's year range, simplifies it
 * with mapshaper and writes public/data/boundaries/ + manifest.json.
 *
 *   npm run data:boundaries
 *
 * The source data is GPL-3.0; its LICENSE is copied next to the output.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { removeSlivers, type AreaFeature } from "./geo-utils";

const REPO = "aourednik/historical-basemaps";
const RAW = `https://raw.githubusercontent.com/${REPO}/master`;
const UA = "Nebuchadnezzar/0.1 (historical map project; data preparation script)";
const MIN_YEAR = -500;
const MAX_YEAR = 1950;
// Files used for 1800-1919; the correction layer replaces them in its region.
const CORRECTED_FILES = new Set([1800, 1815, 1878, 1880, 1900, 1914]);
// Strips left by that cut. About 12,000 km² is well under any polity in the area.
const SLIVER_BOX = { west: 38.5, south: 38.2, east: 51.5, north: 44.8 };
const SLIVER_MAX_SQUARE_DEGREES = 1.2;

const root = resolve(import.meta.dirname, "..");
const cacheDir = join(root, ".cache", "boundaries");
const outDir = join(root, "public", "data", "boundaries");
const mapshaper = join(root, "node_modules", "mapshaper", "bin", "mapshaper");

/** "world_bc323.geojson" → -323, "world_1492.geojson" → 1492. */
function yearFromFilename(name: string): number | null {
  const m = /^world_(bc)?(\d+)\.geojson$/.exec(name);
  if (!m) return null;
  return m[1] ? -Number(m[2]) : Number(m[2]);
}

async function get(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}

async function main() {
  mkdirSync(cacheDir, { recursive: true });
  const region = join(root, ".cache", "natural-earth", "region.json");
  if (!existsSync(region)) throw new Error("Run npm run data:corrections first");
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir)) rmSync(join(outDir, f));

  const listing = (await (await get(`https://api.github.com/repos/${REPO}/contents/geojson`)).json()) as { name: string }[];
  const files = listing
    .map((f) => ({ name: f.name, year: yearFromFilename(f.name) }))
    .filter((f): f is { name: string; year: number } => f.year !== null && f.year >= MIN_YEAR && f.year <= MAX_YEAR)
    .sort((a, b) => a.year - b.year);

  // The earliest slider year needs a file at or before it.
  if (files[0]?.year !== MIN_YEAR) throw new Error(`No boundary file for ${MIN_YEAR}; first is ${files[0]?.year}`);

  const manifest: { year: number; file: string }[] = [];
  for (const { name, year } of files) {
    const raw = join(cacheDir, name);
    if (!existsSync(raw)) {
      writeFileSync(raw, Buffer.from(await (await get(`${RAW}/geojson/${name}`)).arrayBuffer()));
    }
    const file = `${year}.json`;
    const out = join(outDir, file);
    execFileSync(
      process.execPath,
      [
        mapshaper,
        raw,
        "-filter", "NAME != null", "remove-empty",
        "-filter-fields", "NAME,SUBJECTO,BORDERPRECISION",
        "-simplify", "dp", "interval=6km", "keep-shapes",
        "-clean", "allow-overlaps",
        ...(CORRECTED_FILES.has(year) ? ["-erase", region] : []),
        "-o", out, "format=geojson", "precision=0.01", "force",
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    if (CORRECTED_FILES.has(year)) {
      const fc = JSON.parse(readFileSync(out, "utf8")) as { features: AreaFeature[] };
      fc.features = removeSlivers(fc.features, SLIVER_BOX, SLIVER_MAX_SQUARE_DEGREES);
      writeFileSync(out, JSON.stringify(fc));
    }
    manifest.push({ year, file });
    console.log(
      `${String(year).padStart(5)}  ${(statSync(raw).size / 1024).toFixed(0).padStart(5)} KB -> ${(statSync(out).size / 1024).toFixed(0).padStart(4)} KB`,
    );
  }

  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest));
  writeFileSync(join(outDir, "LICENSE"), await (await get(`${RAW}/LICENSE`)).text());
  writeFileSync(
    join(outDir, "NOTICE.txt"),
    `Boundary data derived from historical-basemaps by Andre Ourednik and contributors\n` +
      `https://github.com/${REPO} - licensed under GPL-3.0 (see LICENSE in this folder).\n` +
      `Modifications: filtered to ${MIN_YEAR}..${MAX_YEAR}, unnamed polygons removed, fields reduced, geometry simplified with mapshaper, South Caucasus removed from the 1800-1914 files (see data/manual/south-caucasus.json).\n`,
  );
  console.log(`${manifest.length} files written to ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
