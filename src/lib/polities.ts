import { POLITY_GROUPS, type Polity, type PolityGroup } from "./types";
import { MAX_YEAR, MIN_YEAR, yearToIndex } from "./year";

const AXIS_FROM = yearToIndex(MIN_YEAR);
const AXIS_TO = yearToIndex(MAX_YEAR);

/** Percent along the app's year axis, which has no year 0. */
export const axisPosition = (year: number) => ((yearToIndex(Math.min(MAX_YEAR, Math.max(MIN_YEAR, year))) - AXIS_FROM) / (AXIS_TO - AXIS_FROM)) * 100;

/** A state counts as existing from its first year up to, but not including, its last. */
export function existsInYear(p: Pick<Polity, "from" | "to">, year: number): boolean {
  const y = yearToIndex(year);
  return y >= yearToIndex(p.from) && (p.to === null || y < yearToIndex(p.to));
}

/** Bar position, plus whether the state runs beyond the axis at either end. */
export function barSpan(p: Pick<Polity, "from" | "to">) {
  const left = axisPosition(p.from);
  const right = p.to === null ? 100 : axisPosition(p.to);
  return { left, width: Math.max(right - left, 0), openLeft: p.from < MIN_YEAR, openRight: p.to === null || p.to > MAX_YEAR };
}

/** Rows per region, oldest first, ignoring states that end before the axis begins. */
export function statesByGroup(polities: Polity[]): Record<PolityGroup, Polity[]> {
  const out = Object.fromEntries(POLITY_GROUPS.map((g) => [g, [] as Polity[]])) as Record<PolityGroup, Polity[]>;
  for (const p of polities) {
    if (p.to === null || p.to >= MIN_YEAR) out[p.group].push(p);
  }
  for (const g of POLITY_GROUPS) out[g].sort((a, b) => a.from - b.from);
  return out;
}
