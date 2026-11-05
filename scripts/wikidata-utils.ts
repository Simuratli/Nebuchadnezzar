/** Pure helpers for fetch-wikidata.ts, kept separate so they can be unit tested. */

/**
 * WDQS RDF output uses XSD 1.1 years, where 0000 = 1 BCE and -0330 = 331 BCE
 * (checked against Battle of Gaugamela, 331 BCE, returned as -0330).
 * Converts to historical numbering with no year 0.
 */
export function wikidataTimeToYear(time: string): number | null {
  const m = /^(-?)(\d+)-/.exec(time);
  if (!m) return null;
  const y = Number(m[2]) * (m[1] ? -1 : 1);
  return y <= 0 ? y - 1 : y;
}

export function precisionToDate(p: number): "year" | "month" | "day" | null {
  if (p === 9) return "year";
  if (p === 10) return "month";
  if (p === 11) return "day";
  return null; // decade, century or coarser cannot be placed on the year slider honestly
}

export function parseWktPoint(wkt: string): [number, number] | null {
  const m = /^Point\(([-\d.eE]+) ([-\d.eE]+)\)$/.exec(wkt);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

export type Box = { south: number; west: number; north: number; east: number };

export const REGION_BOXES = {
  kafkasya: { south: 38, west: 38, north: 44, east: 51 },
  osmanli: { south: 22, west: 13, north: 48, east: 48 },
  "ipek-yolu": { south: 30, west: 48, north: 45, east: 120 },
} satisfies Record<string, Box>;

export function splitBox(box: Box, nx: number, ny: number): Box[] {
  const dx = (box.east - box.west) / nx;
  const dy = (box.north - box.south) / ny;
  const out: Box[] = [];
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) {
      out.push({ south: box.south + y * dy, north: box.south + (y + 1) * dy, west: box.west + x * dx, east: box.west + (x + 1) * dx });
    }
  }
  return out;
}

export function regionsForPoint([lng, lat]: [number, number]) {
  return (Object.keys(REGION_BOXES) as (keyof typeof REGION_BOXES)[]).filter((r) => {
    const b = REGION_BOXES[r];
    return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
  });
}

/** Trims text to at most `max` chars, ending on a sentence where one is available. */
export function trimToSentence(text: string, max: number): string {
  // Plain-text extracts drop pronunciation markup, leaving behind "()" or "( ; )".
  const clean = text.replace(/\s*\(\s*[;,]?\s*\)/g, "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > max * 0.4 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export type Candidate = { id: string; category: string; start_year: number; region_tags: string[]; score: number };

/**
 * Picks the most notable candidates per century and category up to `caps`, and
 * within that round-robin across regions, so no era, category or region dominates.
 */
export function selectBalanced<T extends Candidate>(items: T[], caps: Record<string, number>): T[] {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const key = `${Math.floor(it.start_year / 100)}|${it.category}`;
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  const out: T[] = [];
  for (const group of groups.values()) {
    const cap = caps[group[0].category] ?? 0;
    group.sort((a, b) => b.score - a.score);
    const chosen = new Set<string>();
    const regions = [...new Set(group.flatMap((g) => g.region_tags))];
    let progress = true;
    while (chosen.size < Math.min(cap, group.length) && progress) {
      progress = false;
      for (const r of regions) {
        if (chosen.size >= cap) break;
        const next = group.find((g) => !chosen.has(g.id) && g.region_tags.includes(r));
        if (next) {
          chosen.add(next.id);
          out.push(next);
          progress = true;
        }
      }
    }
  }
  return out.sort((a, b) => a.start_year - b.start_year);
}
