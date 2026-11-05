import type { Feature, FeatureCollection } from "geojson";
import { colorForName } from "./boundaries";
import type { Correction } from "./types";
import { yearToIndex } from "./year";

/** Years where the boundary files are cut out and this layer takes over. */
export const CORRECTION_FROM = 1800;
export const CORRECTION_TO = 1920;

export const isCorrectedYear = (year: number) => year >= CORRECTION_FROM && year < CORRECTION_TO;

export function sliceAt(correction: Pick<Correction, "slices">, year: number): Correction["slices"][number] | null {
  const y = yearToIndex(year);
  return correction.slices.find((s) => y >= yearToIndex(s.from) && y < yearToIndex(s.to)) ?? null;
}

let geometry: Promise<FeatureCollection> | null = null;

export function loadCorrectionGeometry(): Promise<FeatureCollection> {
  geometry ??= fetch("/data/corrections/south-caucasus.json").then((r) => {
    if (!r.ok) throw new Error(`corrections: HTTP ${r.status}`);
    return r.json() as Promise<FeatureCollection>;
  });
  geometry.catch(() => {
    geometry = null;
  });
  return geometry;
}

/** Rough size of a feature, to choose where a polity's single label goes. */
function extent(f: Feature): number {
  const coords: number[][] = [];
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") coords.push(c as number[]);
    else if (Array.isArray(c)) c.forEach(walk);
  };
  if (f.geometry.type !== "GeometryCollection") walk(f.geometry.coordinates);
  const xs = coords.map((c) => c[0]);
  const ys = coords.map((c) => c[1]);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
}

/** The layer's data for one year; empty outside the corrected period. */
export function correctionFeatures(base: FeatureCollection | null, corrections: Correction[], year: number): FeatureCollection {
  if (!base || !isCorrectedYear(year)) return { type: "FeatureCollection", features: [] };
  const byId = new Map(corrections.map((c) => [c.id, c]));
  const features = base.features.flatMap((f) => {
    const id = f.properties?.group as string;
    const correction = byId.get(id);
    const slice = correction ? sliceAt(correction, year) : null;
    if (!slice) return [];
    return [{ ...f, properties: { id, name: slice.name, color: colorForName(slice.color_key), label: false } }];
  });
  // Several groups can share a polity; only the largest one carries its name.
  const largest = new Map<string, (typeof features)[number]>();
  for (const f of features) {
    const best = largest.get(f.properties.name);
    if (!best || extent(f) > extent(best)) largest.set(f.properties.name, f);
  }
  for (const f of largest.values()) f.properties.label = true;
  return { type: "FeatureCollection", features };
}
