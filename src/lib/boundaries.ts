import type { FeatureCollection } from "geojson";
import type { BoundaryEntry } from "./year";

const BASE = "/data/boundaries";
const CACHE_SIZE = 12;

// Muted so polygons tint the basemap in both themes without hiding labels.
const PALETTE = ["#b5654a", "#6f8f72", "#7d78a8", "#c29a4b", "#4f8a9b", "#a8688e", "#8c8a4f", "#5d7ba6", "#b07f5a", "#66937f"];

/** Stable colour per polity, so the Ottoman Empire keeps its colour from year to year. */
export function colorForName(name: string | null | undefined): string {
  if (!name) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

let manifest: Promise<BoundaryEntry[]> | null = null;
export function getManifest(): Promise<BoundaryEntry[]> {
  manifest ??= fetch(`${BASE}/manifest.json`).then((r) => {
    if (!r.ok) throw new Error(`manifest: HTTP ${r.status}`);
    return r.json() as Promise<BoundaryEntry[]>;
  });
  manifest.catch(() => {
    manifest = null; // allow a retry after a transient failure
  });
  return manifest;
}

const cache = new Map<string, Promise<FeatureCollection>>();

export function loadBoundary(file: string): Promise<FeatureCollection> {
  const hit = cache.get(file);
  if (hit) return hit;
  const pending = fetch(`${BASE}/${file}`)
    .then((r) => {
      if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
      return r.json() as Promise<FeatureCollection>;
    })
    .then((fc) => {
      for (const f of fc.features) {
        f.properties = { ...f.properties, color: colorForName(f.properties?.SUBJECTO ?? f.properties?.NAME) };
      }
      return fc;
    });
  pending.catch(() => cache.delete(file));
  cache.set(file, pending);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  return pending;
}
