/** Pure geometry helpers for scripts/fetch-entities.ts. */

type Ring = number[][];
type PolygonCoords = Ring[];
export type AreaGeometry = { type: "Polygon"; coordinates: PolygonCoords } | { type: "MultiPolygon"; coordinates: PolygonCoords[] };
export type AreaFeature = { geometry: AreaGeometry | null; properties: { NAME?: string | null; SUBJECTO?: string | null } | null };

function inRing([x, y]: [number, number], ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const inPolygon = (p: [number, number], [outer, ...holes]: PolygonCoords) => inRing(p, outer) && !holes.some((h) => inRing(p, h));

export function pointInGeometry(p: [number, number], g: AreaGeometry): boolean {
  return g.type === "Polygon" ? inPolygon(p, g.coordinates) : g.coordinates.some((poly) => inPolygon(p, poly));
}

const rings = (g: AreaGeometry): Ring[] => (g.type === "Polygon" ? g.coordinates : g.coordinates.flat());

/** Squared distance in degrees to the nearest ring segment; only compared with a small tolerance. */
function distanceToGeometry([x, y]: [number, number], g: AreaGeometry): number {
  let best = Infinity;
  for (const ring of rings(g)) {
    for (let i = 1; i < ring.length; i++) {
      const [ax, ay] = ring[i - 1];
      const [bx, by] = ring[i];
      const dx = bx - ax;
      const dy = by - ay;
      const len = dx * dx + dy * dy;
      const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len));
      best = Math.min(best, (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2);
    }
  }
  return best;
}

/** Coastal cities can fall just outside simplified polygons, so a small gap is tolerated. */
const COAST_TOLERANCE_DEGREES = 0.5;

/** The authority holding a point in one boundary file, or null when none is near. */
export function rulerAt(p: [number, number], features: AreaFeature[]): string | null {
  const name = (f: AreaFeature) => f.properties?.SUBJECTO ?? f.properties?.NAME ?? null;
  for (const f of features) if (f.geometry && pointInGeometry(p, f.geometry)) return name(f);
  let best: AreaFeature | null = null;
  let bestDistance = COAST_TOLERANCE_DEGREES ** 2;
  for (const f of features) {
    if (!f.geometry) continue;
    const d = distanceToGeometry(p, f.geometry);
    if (d < bestDistance) {
      bestDistance = d;
      best = f;
    }
  }
  return best ? name(best) : null;
}

export type Ruler = { from: number; to: number; name: string | null; manual: boolean };

/** Collapses per-file results into periods. Each file holds until the next file's year. */
export function mergeRulers(samples: { year: number; name: string | null }[], lastYear: number): Ruler[] {
  const out: Ruler[] = [];
  samples.forEach((s, i) => {
    const to = samples[i + 1]?.year ?? lastYear;
    const prev = out[out.length - 1];
    if (prev && prev.name === s.name) prev.to = to;
    else out.push({ from: s.year, to, name: s.name, manual: false });
  });
  return out;
}

/**
 * Lays hand-corrected periods over the computed ones. The boundary data has known
 * errors at city level (it shows the South Caucasus as Persia until 1914, for one),
 * and each correction stays marked as manual in the output.
 */
export function applyRulerOverrides(rulers: Ruler[], overrides: { from: number; to: number; name: string }[]): Ruler[] {
  let out = rulers.map((r) => ({ ...r }));
  for (const o of overrides) {
    const next: Ruler[] = [];
    for (const r of out) {
      if (r.to <= o.from || r.from >= o.to) {
        next.push(r);
        continue;
      }
      if (r.from < o.from) next.push({ ...r, to: o.from });
      if (r.to > o.to) next.push({ ...r, from: o.to });
    }
    next.push({ from: o.from, to: o.to, name: o.name, manual: true });
    out = next.sort((a, b) => a.from - b.from);
  }
  return out;
}

/** A hand-entered name period counts as confirmed if a dated Wikidata statement shares a boundary year. */
export function periodConfirmed(
  period: { from: number | null; to: number | null },
  statements: { start: number | null; end: number | null }[],
): boolean {
  const near = (a: number | null, b: number | null) => a !== null && b !== null && Math.abs(a - b) <= 1;
  return statements.some((s) => near(period.from, s.start) || near(period.to, s.end));
}
