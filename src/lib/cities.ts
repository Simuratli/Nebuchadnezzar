import type { City, EventSummary } from "./types";
import { yearToIndex } from "./year";

/** Radius for "events around this city"; events only carry a point, not a city link. */
export const NEARBY_KM = 40;

/** The city's name in a given year. A period covers its start year but not its end year. */
export function nameAtYear(city: Pick<City, "name" | "periods">, year: number): string {
  const y = yearToIndex(year);
  const match = city.periods.find(
    (p) => (p.from === null || y >= yearToIndex(p.from)) && (p.to === null || y < yearToIndex(p.to)),
  );
  return match?.name ?? city.name;
}

export function rulerAtYear(city: Pick<City, "rulers">, year: number): City["rulers"][number] | null {
  const y = yearToIndex(year);
  return city.rulers.find((r, i) => y >= yearToIndex(r.from) && (y < yearToIndex(r.to) || i === city.rulers.length - 1)) ?? null;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function distanceKm(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Events within the radius, oldest first. Line events count by any of their vertices. */
export function eventsNearCity<T extends EventSummary>(events: T[], city: { lng: number; lat: number }, km = NEARBY_KM): T[] {
  const near = ([lng, lat]: [number, number]) => distanceKm(city, { lng, lat }) <= km;
  return events
    .filter((e) => (e.geometry.type === "Point" ? near(e.geometry.coordinates) : e.geometry.coordinates.some(near)))
    .sort((a, b) => a.start_year - b.start_year);
}
