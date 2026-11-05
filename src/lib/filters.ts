import type { Category, EventSummary, Region } from "./types";
import { isVisibleAt, yearToIndex } from "./year";

export type Filters = {
  categories: Category[];
  regions: Region[];
  from: number | null;
  to: number | null;
};

export const EMPTY_FILTERS: Filters = { categories: [], regions: [], from: null, to: null };

export const hasActiveFilters = (f: Filters) => f.categories.length > 0 || f.regions.length > 0 || f.from !== null || f.to !== null;

/** Empty selections mean "all". A year range matches any event overlapping it. */
export function filterEvents<T extends EventSummary>(events: T[], f: Filters): T[] {
  return events.filter((e) => {
    if (f.categories.length && !f.categories.includes(e.category)) return false;
    if (f.regions.length && !e.region_tags.some((r) => f.regions.includes(r))) return false;
    if (f.from !== null && yearToIndex(e.end_year ?? e.start_year) < yearToIndex(f.from)) return false;
    if (f.to !== null && yearToIndex(e.start_year) > yearToIndex(f.to)) return false;
    return true;
  });
}

export function eventsAtYear<T extends EventSummary>(events: T[], year: number, windowYears: number): T[] {
  return events.filter((e) => isVisibleAt(e.start_year, e.end_year, year, windowYears));
}
