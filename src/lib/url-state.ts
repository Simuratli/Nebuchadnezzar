import { clampYear } from "./year";

export type UrlState = {
  year: number;
  lat: number;
  lng: number;
  zoom: number;
  compare: boolean;
  year2: number;
  eventId: string | null;
  routeId: string | null;
  tourId: string | null;
  personId: string | null;
  cityId: string | null;
};

export const DEFAULT_URL_STATE: UrlState = {
  year: 1453,
  lat: 40,
  lng: 45,
  zoom: 3.4,
  compare: false,
  year2: 1800,
  eventId: null,
  routeId: null,
  tourId: null,
  personId: null,
  cityId: null,
};

const numberParam = (value: string | null, min: number, max: number) => {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/** Ids reach API URLs and map filters, so only safe slugs are accepted. */
const idParam = (value: string | null) => (value && /^[\w-]{1,64}$/.test(value) ? value : null);

export function parseUrlState(search: string): UrlState {
  const p = new URLSearchParams(search);
  const d = DEFAULT_URL_STATE;
  const year = numberParam(p.get("y"), -100000, 100000);
  const year2 = numberParam(p.get("y2"), -100000, 100000);
  return {
    year: year === null ? d.year : clampYear(year),
    lat: numberParam(p.get("lat"), -90, 90) ?? d.lat,
    lng: numberParam(p.get("lng"), -180, 180) ?? d.lng,
    zoom: numberParam(p.get("z"), 0, 22) ?? d.zoom,
    compare: p.get("mode") === "compare",
    year2: year2 === null ? d.year2 : clampYear(year2),
    eventId: idParam(p.get("e")),
    routeId: idParam(p.get("route")),
    tourId: idParam(p.get("tour")),
    personId: idParam(p.get("person")),
    cityId: idParam(p.get("city")),
  };
}

export function serializeUrlState(s: UrlState): string {
  const p = new URLSearchParams();
  p.set("y", String(s.year));
  p.set("lat", s.lat.toFixed(3));
  p.set("lng", s.lng.toFixed(3));
  p.set("z", s.zoom.toFixed(2));
  if (s.compare) {
    p.set("mode", "compare");
    p.set("y2", String(s.year2));
  }
  if (s.eventId) p.set("e", s.eventId);
  if (s.routeId) p.set("route", s.routeId);
  if (s.tourId) p.set("tour", s.tourId);
  if (s.personId) p.set("person", s.personId);
  if (s.cityId) p.set("city", s.cityId);
  return p.toString();
}
