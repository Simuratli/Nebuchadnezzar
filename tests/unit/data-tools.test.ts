import { describe, expect, it } from "vitest";
import { createLocalCollectionStore } from "@/lib/collection";
import { csvCell, eventsToCsv, eventsToGeoJson } from "@/lib/export";
import { EMPTY_FILTERS, eventsAtYear, filterEvents } from "@/lib/filters";
import { createSearch, foldText } from "@/lib/search";
import type { City, EventSummary, Person } from "@/lib/types";

const ev = (over: Partial<EventSummary>): EventSummary => ({
  id: "x",
  title: "Olay",
  summary: "",
  start_year: 1000,
  end_year: null,
  date_precision: "year",
  geometry: { type: "Point", coordinates: [30, 40] },
  category: "savas",
  region_tags: ["osmanli"],
  wikidata_id: null,
  image_url: null,
  content_lang: "tr",
  needs_review: false,
  ...over,
});

const events = [
  ev({ id: "a", title: "İstanbul'un Fethi", start_year: 1453, category: "savas", region_tags: ["osmanli"] }),
  ev({ id: "b", title: "Malazgirt Muharebesi", start_year: 1071, category: "savas", region_tags: ["osmanli", "kafkasya"] }),
  ev({ id: "c", title: "Semerkant Medresesi", start_year: 1420, end_year: 1450, category: "bilim", region_tags: ["ipek-yolu"] }),
  ev({ id: "d", title: "Gaugamela", start_year: -331, category: "savas", region_tags: ["osmanli"] }),
];
const ids = (list: { id: string }[]) => list.map((e) => e.id);

describe("filterEvents", () => {
  it("returns everything with empty filters", () => {
    expect(filterEvents(events, EMPTY_FILTERS)).toHaveLength(4);
  });
  it("filters by category and region", () => {
    expect(ids(filterEvents(events, { ...EMPTY_FILTERS, categories: ["bilim"] }))).toEqual(["c"]);
    expect(ids(filterEvents(events, { ...EMPTY_FILTERS, regions: ["kafkasya"] }))).toEqual(["b"]);
  });
  it("matches events overlapping the year range", () => {
    expect(ids(filterEvents(events, { ...EMPTY_FILTERS, from: 1440, to: 1445 }))).toEqual(["c"]);
    expect(ids(filterEvents(events, { ...EMPTY_FILTERS, to: -1 }))).toEqual(["d"]);
    expect(ids(filterEvents(events, { ...EMPTY_FILTERS, from: 1453 }))).toEqual(["a"]);
  });
  it("combines conditions with AND", () => {
    expect(filterEvents(events, { ...EMPTY_FILTERS, categories: ["bilim"], from: 1500 })).toEqual([]);
  });
  it("selects events around a year", () => {
    expect(ids(eventsAtYear(events, 1460, 10))).toEqual(["a", "c"]);
  });
});

describe("search", () => {
  const people = [{ id: "p", name: "Evliya Çelebi", birth_year: 1611, death_year: 1682, wikidata_id: null }] as Person[];
  const cities = [{ id: "gence", name: "Gence", periods: [{ name: "Kirovabad", from: 1935, to: 1989, confirmed: true }], other_names: [] }] as unknown as City[];
  const search = createSearch(events, people, cities);

  it("folds Turkish letters both ways", () => {
    expect(foldText("İSTANBUL")).toBe("istanbul");
    expect(foldText("Çelebi")).toBe("celebi");
    expect(foldText("Sıvas")).toBe("sivas");
  });
  it("finds events regardless of Turkish characters and case", () => {
    expect(search("istanbul")[0]).toMatchObject({ kind: "event", item: { id: "a" } });
    expect(search("İSTANBUL")[0]).toMatchObject({ kind: "event", item: { id: "a" } });
  });
  it("tolerates typos", () => {
    expect(search("malazgrt")[0]).toMatchObject({ item: { id: "b" } });
  });
  it("finds people", () => {
    expect(search("evliya celebi")[0]).toMatchObject({ kind: "person", item: { id: "p" } });
  });
  it("finds cities by their old names", () => {
    expect(search("kirovabad")[0]).toMatchObject({ kind: "city", item: { id: "gence" } });
  });
  it("ignores too-short queries and unrelated text", () => {
    expect(search("a")).toEqual([]);
    expect(search("zzzzqqq")).toEqual([]);
  });
});

describe("export", () => {
  it("neutralises formula injection", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+90")).toBe("'+90");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("-1")).toBe("'-1");
  });
  it("leaves numbers (including BCE years) as real numbers", () => {
    expect(csvCell(-331)).toBe("-331");
    expect(csvCell(null)).toBe("");
  });
  it("quotes separators, quotes and newlines", () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
  });
  it("writes a BOM, a header and one row per event", () => {
    const csv = eventsToCsv(events);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.trim().split("\r\n")).toHaveLength(events.length + 1);
    expect(csv).toContain("İstanbul'un Fethi");
  });
  it("uses the first coordinate for line events", () => {
    const csv = eventsToCsv([ev({ geometry: { type: "LineString", coordinates: [[1, 2], [3, 4]] } })]);
    expect(csv).toContain(",1,2,");
  });
  it("produces valid GeoJSON features", () => {
    const fc = eventsToGeoJson(events);
    expect(fc.features).toHaveLength(4);
    expect(fc.features[0]).toMatchObject({ type: "Feature", id: "a", geometry: { type: "Point" }, properties: { title: "İstanbul'un Fethi" } });
    expect(fc.features[0].properties).not.toHaveProperty("geometry");
  });
});

describe("local collection store", () => {
  const memory = (initial?: string) => {
    let value = initial ?? null;
    return { getItem: () => value, setItem: (_: string, v: string) => void (value = v) };
  };
  it("round-trips items", () => {
    const store = createLocalCollectionStore(memory());
    const items = [{ eventId: "a", note: "not", addedAt: "2026-11-05T00:00:00Z" }];
    store.save(items);
    expect(store.load()).toEqual(items);
  });
  it("survives corrupt, wrongly shaped or missing storage", () => {
    expect(createLocalCollectionStore(memory("{bozuk")).load()).toEqual([]);
    expect(createLocalCollectionStore(memory('[{"x":1}]')).load()).toEqual([]);
    expect(createLocalCollectionStore(null).load()).toEqual([]);
  });
  it("does not throw when storage rejects a write", () => {
    const store = createLocalCollectionStore({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(() => store.save([])).not.toThrow();
  });
});
