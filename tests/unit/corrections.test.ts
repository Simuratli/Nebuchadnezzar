import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import cities from "../../data/seed/cities.json";
import corrections from "../../data/seed/corrections.json";
import { pointInGeometry, removeSlivers, rulerAt, type AreaFeature, type AreaGeometry } from "../../scripts/geo-utils";
import { correctionFeatures, CORRECTION_FROM, CORRECTION_TO, isCorrectedYear, sliceAt } from "@/lib/corrections";
import { correctionSchema, type Correction } from "@/lib/types";

const list = corrections as Correction[];
const read = <T,>(path: string) => JSON.parse(readFileSync(path, "utf8")) as T;
const geometry = read<{ type: "FeatureCollection"; features: { properties: { group: string }; geometry: AreaGeometry }[] }>("public/data/corrections/south-caucasus.json");
const groupAt = (p: [number, number]) => geometry.features.find((f) => pointInGeometry(p, f.geometry))?.properties.group;

const TIFLIS: [number, number] = [44.79, 41.72];
const GENCE: [number, number] = [46.36, 40.68];
const BAKU: [number, number] = [49.84, 40.41];
const ERIVAN: [number, number] = [44.51, 40.18];
const KARS: [number, number] = [43.1, 40.6];
const TEBRIZ: [number, number] = [46.29, 38.08];
const TAHRAN: [number, number] = [51.39, 35.69];

const sliceFor = (group: string, year: number) => {
  const c = list.find((x) => x.id === group);
  return c ? sliceAt(c, year) : null;
};

describe("correction records", () => {
  it("satisfy the schema and stay flagged for review", () => {
    for (const c of list) {
      correctionSchema.parse(c);
      expect(c.needs_review, c.id).toBe(true);
    }
  });
  it("cover the whole period without gaps or overlaps", () => {
    for (const c of list) {
      expect(c.slices[0].from, c.id).toBe(CORRECTION_FROM);
      expect(c.slices.at(-1)?.to, c.id).toBe(CORRECTION_TO);
      c.slices.slice(1).forEach((s, i) => expect(s.from, c.id).toBe(c.slices[i].to));
    }
  });
  it("cite a source on every period", () => {
    for (const c of list) for (const s of c.slices) expect(s.sources.length, `${c.id} ${s.from}`).toBeGreaterThan(0);
  });
  it("have one geometry per group", () => {
    expect(geometry.features.map((f) => f.properties.group).sort()).toEqual(list.map((c) => c.id).sort());
  });
});

describe("treaty dates", () => {
  it("places known cities in the expected groups", () => {
    expect(groupAt(TIFLIS)).toBe("kartli");
    expect(groupAt(GENCE)).toBe("azerbaycan");
    expect(groupAt(BAKU)).toBe("azerbaycan");
    expect(groupAt(ERIVAN)).toBe("erivan");
    expect(groupAt(KARS)).toBe("kars");
    expect(groupAt(TEBRIZ)).toBeUndefined();
  });
  it("follows the 1801, 1813, 1828, 1829 and 1878 changes", () => {
    expect(sliceFor("kartli", 1800)?.name).toBe("Kartli-Kaheti Krallığı");
    expect(sliceFor("kartli", 1801)?.name).toBe("Rus İmparatorluğu");
    expect(sliceFor("azerbaycan", 1813)?.name).toBe("Rus İmparatorluğu");
    expect(sliceFor("erivan", 1827)?.name).toContain("Erivan Hanlığı");
    expect(sliceFor("erivan", 1828)?.name).toBe("Rus İmparatorluğu");
    expect(sliceFor("nahcivan", 1828)?.name).toBe("Rus İmparatorluğu");
    expect(sliceFor("meshetya", 1828)?.name).toBe("Osmanlı İmparatorluğu");
    expect(sliceFor("meshetya", 1829)?.name).toBe("Rus İmparatorluğu");
    expect(sliceFor("kars", 1877)?.name).toBe("Osmanlı İmparatorluğu");
    expect(sliceFor("kars", 1878)?.name).toBe("Rus İmparatorluğu");
    expect(sliceFor("batum", 1878)?.name).toBe("Rus İmparatorluğu");
    expect(sliceFor("sirak", 1804)?.name).toBe("Rus ilhakı sürüyor");
  });
  it("shows contested areas as contested in 1918-1920", () => {
    expect(sliceFor("karabag-zengezur", 1919)?.name).toContain("İhtilaflı");
    expect(sliceFor("nahcivan", 1919)?.name).toContain("İhtilaflı");
  });
});

describe("the layer for a year", () => {
  const base = geometry as unknown as GeoJSON.FeatureCollection;
  it("is empty outside the corrected period and without geometry", () => {
    expect(correctionFeatures(base, list, 1799).features).toEqual([]);
    expect(correctionFeatures(base, list, 1920).features).toEqual([]);
    expect(correctionFeatures(null, list, 1880).features).toEqual([]);
    expect(isCorrectedYear(1919)).toBe(true);
  });
  it("covers every group inside the period, labelled for that year", () => {
    const features = correctionFeatures(base, list, 1880).features;
    expect(features).toHaveLength(list.length);
    expect(features.every((f) => f.properties?.name === "Rus İmparatorluğu")).toBe(true);
    expect(new Set(features.map((f) => f.properties?.color)).size).toBe(1);
  });
});

describe("labels", () => {
  const base = geometry as unknown as GeoJSON.FeatureCollection;
  const labels = (year: number) => correctionFeatures(base, list, year).features.filter((f) => f.properties?.label).map((f) => f.properties?.name);
  it("name each polity once", () => {
    expect(labels(1880)).toEqual(["Rus İmparatorluğu"]);
    expect(new Set(labels(1820)).size).toBe(labels(1820).length);
    expect(labels(1820)).toEqual(expect.arrayContaining(["Rus İmparatorluğu", "Osmanlı İmparatorluğu", "Erivan Hanlığı (İran)"]));
  });
});

describe("removeSlivers", () => {
  const square = (x: number, y: number, size: number) => [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]];
  const box = { west: 0, south: 0, east: 10, north: 10 };
  const multi = (...polys: number[][][][]): AreaFeature => ({ geometry: { type: "MultiPolygon", coordinates: polys }, properties: { NAME: "X" } });

  it("drops small parts inside the box and keeps the main body", () => {
    const out = removeSlivers([multi(square(1, 1, 0.5), square(20, 20, 10))], box, 1);
    expect(out[0].geometry?.coordinates).toEqual([square(20, 20, 10)]);
  });
  it("keeps large parts inside the box", () => {
    expect(removeSlivers([multi(square(1, 1, 5))], box, 1)[0].geometry?.coordinates).toEqual([square(1, 1, 5)]);
  });
  it("keeps small parts outside or crossing the box", () => {
    expect(removeSlivers([multi(square(50, 50, 0.5))], box, 1)).toHaveLength(1);
    expect(removeSlivers([multi(square(9.8, 1, 0.5))], box, 1)).toHaveLength(1);
  });
  it("removes a feature when nothing remains", () => {
    expect(removeSlivers([{ geometry: { type: "Polygon", coordinates: square(1, 1, 0.5) }, properties: {} }], box, 1)).toEqual([]);
  });
});

describe("boundary files", () => {
  const boundary = (year: number) => read<{ features: AreaFeature[] }>(`public/data/boundaries/${year}.json`).features;
  const contains = (features: AreaFeature[], p: [number, number]) => features.some((f) => f.geometry && pointInGeometry(p, f.geometry));

  it("no longer show the region inside the corrected period", () => {
    for (const year of [1800, 1815, 1878, 1880, 1900, 1914]) {
      const features = boundary(year);
      for (const p of [TIFLIS, GENCE, ERIVAN, KARS]) expect(contains(features, p), `${year} ${p}`).toBe(false);
    }
  });
  it("leave no strip of the old polities in the region", () => {
    const features = boundary(1880);
    const inBox = (f: AreaFeature) => {
      const g = f.geometry;
      if (!g) return false;
      const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      return polys.some((poly) => poly[0].every(([x, y]) => x >= 38.5 && x <= 51.5 && y >= 38.2 && y <= 44.8));
    };
    expect(features.filter(inBox).map((f) => f.properties?.NAME)).toEqual([]);
  });
  it("keep it outside the period", () => {
    expect(rulerAt(TIFLIS, boundary(1783))).not.toBeNull();
    expect(rulerAt(TIFLIS, boundary(1920))).toBe("USSR");
  });
  it("keep Persia south of the Aras", () => {
    expect(rulerAt(TEBRIZ, boundary(1880))).toBe("Persia");
    expect(rulerAt(TAHRAN, boundary(1880))).toBe("Persia");
  });
});

describe("city rulers", () => {
  const rulerOf = (id: string, year: number) => cities.find((c) => c.id === id)?.rulers.find((r) => r.from <= year && r.to > year);

  it("agree with the correction layer", () => {
    expect(rulerOf("gence", 1880)?.name).toBe("Rus İmparatorluğu");
    expect(rulerOf("tiflis", 1800)?.name).toBe("Kartli-Kaheti Krallığı");
    expect(rulerOf("erivan", 1827)?.name).toContain("Erivan Hanlığı");
    expect(rulerOf("kars", 1850)?.name).toBe("Osmanlı İmparatorluğu");
    expect(rulerOf("kars", 1900)?.name).toBe("Rus İmparatorluğu");
    expect(rulerOf("batum", 1900)?.name).toBe("Rus İmparatorluğu");
  });
  it("use the verified 1804 date for Gümrü instead of the earlier 1829", () => {
    expect(rulerOf("gumru", 1810)?.name).toBe("Rus ilhakı sürüyor");
    expect(rulerOf("gumru", 1820)?.name).toBe("Rus İmparatorluğu");
  });
  it("leave no unknown ruler in the corrected period for cities in the region", () => {
    for (const id of ["gence", "baku", "tiflis", "erivan", "gumru", "nahcivan", "batum", "kars"]) {
      for (const year of [1800, 1830, 1880, 1919]) expect(rulerOf(id, year)?.name, `${id} ${year}`).toBeTruthy();
    }
  });
  it("leave cities just outside the region alone", () => {
    expect(rulerOf("derbent", 1880)?.name).toBe("Rus İmparatorluğu");
    expect(rulerOf("tebriz", 1880)?.name).toBe("Persia");
    expect(rulerOf("trabzon", 1880)?.name).toBe("Ottoman Empire");
  });
  it("still mark corrected periods as manual", () => {
    expect(rulerOf("gence", 1880)?.manual).toBe(true);
  });
});
