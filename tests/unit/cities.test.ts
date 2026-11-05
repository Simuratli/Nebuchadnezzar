import { describe, expect, it } from "vitest";
import { applyRulerOverrides, mergeRulers, periodConfirmed, pointInGeometry, rulerAt, type AreaFeature, type AreaGeometry } from "../../scripts/geo-utils";
import cities from "../../data/seed/cities.json";
import { distanceKm, eventsNearCity, nameAtYear, rulerAtYear } from "@/lib/cities";
import { storedCitySchema, type EventSummary } from "@/lib/types";

const square = (x: number, y: number, size = 1): AreaGeometry => ({
  type: "Polygon",
  coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]],
});

describe("point in polygon", () => {
  it("detects inside and outside", () => {
    expect(pointInGeometry([0.5, 0.5], square(0, 0))).toBe(true);
    expect(pointInGeometry([2, 2], square(0, 0))).toBe(false);
  });
  it("respects holes", () => {
    const holed: AreaGeometry = { type: "Polygon", coordinates: [square(0, 0, 10).coordinates[0] as number[][], square(4, 4, 2).coordinates[0] as number[][]] };
    expect(pointInGeometry([5, 5], holed)).toBe(false);
    expect(pointInGeometry([1, 1], holed)).toBe(true);
  });
  it("handles multipolygons", () => {
    const multi: AreaGeometry = { type: "MultiPolygon", coordinates: [square(0, 0).coordinates as number[][][], square(5, 5).coordinates as number[][][]] };
    expect(pointInGeometry([5.5, 5.5], multi)).toBe(true);
  });
});

describe("rulerAt", () => {
  const f = (name: string | null, subject: string | null, g: AreaGeometry): AreaFeature => ({ geometry: g, properties: { NAME: name, SUBJECTO: subject } });
  it("prefers the controlling authority over the local name", () => {
    expect(rulerAt([0.5, 0.5], [f("Azerbaijan", "USSR", square(0, 0))])).toBe("USSR");
  });
  it("tolerates a small coastal gap but not a large one", () => {
    const features = [f("Kıyı", "Kıyı", square(0, 0))];
    expect(rulerAt([1.3, 0.5], features)).toBe("Kıyı");
    expect(rulerAt([3, 0.5], features)).toBeNull();
  });
});

describe("mergeRulers", () => {
  it("merges consecutive files and closes the last period", () => {
    expect(mergeRulers([{ year: 100, name: "A" }, { year: 200, name: "A" }, { year: 300, name: "B" }], 1950)).toEqual([
      { from: 100, to: 300, name: "A", manual: false },
      { from: 300, to: 1950, name: "B", manual: false },
    ]);
  });
});

describe("applyRulerOverrides", () => {
  const base = [
    { from: 1000, to: 1800, name: "A", manual: false },
    { from: 1800, to: 1950, name: "Persia", manual: false },
  ];
  it("replaces the covered range and keeps the rest", () => {
    expect(applyRulerOverrides(base, [{ from: 1804, to: 1918, name: "Rus" }])).toEqual([
      { from: 1000, to: 1800, name: "A", manual: false },
      { from: 1800, to: 1804, name: "Persia", manual: false },
      { from: 1804, to: 1918, name: "Rus", manual: true },
      { from: 1918, to: 1950, name: "Persia", manual: false },
    ]);
  });
  it("can swallow whole periods", () => {
    expect(applyRulerOverrides(base, [{ from: 900, to: 1950, name: "X" }])).toEqual([{ from: 900, to: 1950, name: "X", manual: true }]);
  });
  it("returns a copy unchanged without overrides", () => {
    expect(applyRulerOverrides(base, [])).toEqual(base);
  });
});

describe("periodConfirmed", () => {
  it("confirms on a matching boundary year, within one year", () => {
    expect(periodConfirmed({ from: 1804, to: 1918 }, [{ start: 1804, end: null }])).toBe(true);
    expect(periodConfirmed({ from: 1804, to: 1918 }, [{ start: null, end: 1917 }])).toBe(true);
  });
  it("does not confirm unrelated or open statements", () => {
    expect(periodConfirmed({ from: 1804, to: 1918 }, [{ start: 1700, end: 1750 }])).toBe(false);
    expect(periodConfirmed({ from: null, to: null }, [{ start: null, end: null }])).toBe(false);
  });
});

describe("city helpers", () => {
  const city = {
    name: "Gence",
    periods: [
      { name: "Gence", from: null, to: 1804, confirmed: false },
      { name: "Yelizavetpol", from: 1804, to: 1918, confirmed: true },
      { name: "Kirovabad", from: 1935, to: 1989, confirmed: true },
    ],
    rulers: [
      { from: -500, to: 1000, name: "A", manual: false },
      { from: 1000, to: 1950, name: "B", manual: false },
    ],
  };

  it("names a city by year, with the end year exclusive", () => {
    expect(nameAtYear(city, 1500)).toBe("Gence");
    expect(nameAtYear(city, 1804)).toBe("Yelizavetpol");
    expect(nameAtYear(city, 1917)).toBe("Yelizavetpol");
    expect(nameAtYear(city, 1940)).toBe("Kirovabad");
  });
  it("falls back to the main name in gaps", () => {
    expect(nameAtYear(city, 1925)).toBe("Gence");
    expect(nameAtYear({ name: "Bakü", periods: [] }, 1000)).toBe("Bakü");
  });
  it("finds the ruler for a year, including the last year", () => {
    expect(rulerAtYear(city, 999)?.name).toBe("A");
    expect(rulerAtYear(city, 1000)?.name).toBe("B");
    expect(rulerAtYear(city, 1950)?.name).toBe("B");
  });
  it("measures distance on the sphere", () => {
    expect(distanceKm({ lng: 28.97, lat: 41.01 }, { lng: 32.85, lat: 39.93 })).toBeGreaterThan(340);
    expect(distanceKm({ lng: 28.97, lat: 41.01 }, { lng: 32.85, lat: 39.93 })).toBeLessThan(360);
  });
  it("finds nearby point and line events, oldest first", () => {
    const ev = (id: string, start_year: number, geometry: EventSummary["geometry"]) => ({ id, start_year, geometry }) as EventSummary;
    const events = [
      ev("far", 1000, { type: "Point", coordinates: [40, 40] }),
      ev("later", 1500, { type: "Point", coordinates: [29, 41] }),
      ev("line", 1200, { type: "LineString", coordinates: [[10, 10], [29, 41]] }),
    ];
    expect(eventsNearCity(events, { lng: 28.97, lat: 41.01 }).map((e) => e.id)).toEqual(["line", "later"]);
  });
});

describe("cities seed", () => {
  it("satisfies the schema with unique ids", () => {
    for (const c of cities) storedCitySchema.parse(c);
    expect(new Set(cities.map((c) => c.id)).size).toBe(cities.length);
    expect(cities.length).toBeGreaterThanOrEqual(30);
  });
  it("has ordered, contiguous-or-open periods and rulers", () => {
    for (const c of cities) {
      for (const r of c.rulers) expect(r.to, c.id).toBeGreaterThan(r.from);
      c.rulers.slice(1).forEach((r, i) => expect(r.from, c.id).toBe(c.rulers[i].to));
    }
  });
  it("includes the Gence name chain and corrected Caucasus rulers", () => {
    const gence = cities.find((c) => c.id === "gence");
    expect(gence?.periods.map((p) => p.name)).toEqual(["Gence", "Yelizavetpol", "Gence", "Kirovabad", "Gence"]);
    const at1880 = gence?.rulers.find((r) => r.from <= 1880 && r.to > 1880);
    expect(at1880).toMatchObject({ name: "Rus İmparatorluğu", manual: true });
  });
  it("flags cities with unconfirmed names", () => {
    for (const c of cities) {
      if (c.periods.some((p) => !p.confirmed) || c.other_names.length > 0) expect(c.needs_review, c.id).toBe(true);
    }
  });
});
