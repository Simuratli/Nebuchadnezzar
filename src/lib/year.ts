/**
 * Year arithmetic. Years are historical: -331 = 331 BCE, 1453 = 1453 CE, and
 * year 0 does not exist, so 1 BCE (-1) is directly followed by 1 CE (1).
 * "Index" is a continuous axis without the gap, used for sliders and durations.
 */
export const MIN_YEAR = -500;
export const MAX_YEAR = 1950;

export const yearToIndex = (year: number) => (year < 0 ? year + 1 : year);
export const indexToYear = (index: number) => (index <= 0 ? index - 1 : index);

export const clampYear = (year: number) => {
  const y = Math.min(MAX_YEAR, Math.max(MIN_YEAR, Math.round(year)));
  return y === 0 ? 1 : y;
};

/** Adds a duration in years, stepping over the missing year 0. */
export const addYears = (year: number, delta: number) => clampYear(indexToYear(yearToIndex(year) + delta));

/** Era labels of a language. suffix puts the label after the year ("331 BCE"), otherwise before ("MÖ 331"). */
export type Era = { bc: string; ad: string; suffix?: boolean };

export function formatYear(year: number, era: Era) {
  const label = year < 0 ? era.bc : era.ad;
  const value = Math.abs(year);
  return era.suffix ? `${value} ${label}` : `${label} ${value}`;
}

export function formatYearRange(start: number, end: number | null, era: Era) {
  if (end === null || end === start) return formatYear(start, era);
  return `${formatYear(start, era)} – ${formatYear(end, era)}`;
}

export type BoundaryEntry = { year: number; file: string };

/** The newest boundary file not later than `year`; falls back to the oldest one. */
export function boundaryForYear(year: number, manifest: BoundaryEntry[]): BoundaryEntry | null {
  let best: BoundaryEntry | null = null;
  for (const entry of manifest) {
    if (entry.year <= year && (!best || entry.year > best.year)) best = entry;
  }
  if (best) return best;
  return manifest.reduce<BoundaryEntry | null>((a, b) => (!a || b.year < a.year ? b : a), null);
}

/** The file after the current one, for prefetching during playback. */
export function nextBoundary(year: number, manifest: BoundaryEntry[]): BoundaryEntry | null {
  let best: BoundaryEntry | null = null;
  for (const entry of manifest) {
    if (entry.year > year && (!best || entry.year < best.year)) best = entry;
  }
  return best;
}

/** Single-year events would flash past on the slider, so they stay visible for ±windowYears. */
export function isVisibleAt(start: number, end: number | null, year: number, windowYears: number) {
  const y = yearToIndex(year);
  return y >= yearToIndex(start) - windowYears && y <= yearToIndex(end ?? start) + windowYears;
}
