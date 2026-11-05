import { describe, expect, it } from "vitest";
import {
  parseWktPoint,
  precisionToDate,
  regionsForPoint,
  selectBalanced,
  trimToSentence,
  wikidataTimeToYear,
} from "../../scripts/wikidata-utils";

describe("wikidataTimeToYear", () => {
  it("corrects the XSD 1.1 BCE offset (Gaugamela, 331 BCE, is served as -0330)", () => {
    expect(wikidataTimeToYear("-0330-09-26T00:00:00Z")).toBe(-331);
    expect(wikidataTimeToYear("-0332-10-31T00:00:00Z")).toBe(-333);
  });

  it("maps XSD year 0000 to 1 BCE", () => {
    expect(wikidataTimeToYear("0000-01-01T00:00:00Z")).toBe(-1);
  });

  it("keeps CE years", () => {
    expect(wikidataTimeToYear("1453-05-29T00:00:00Z")).toBe(1453);
    expect(wikidataTimeToYear("0194-01-01T00:00:00Z")).toBe(194);
  });

  it("returns null for unparseable input", () => {
    expect(wikidataTimeToYear("unknown")).toBeNull();
  });
});

describe("helpers", () => {
  it("maps only year-or-finer precision", () => {
    expect(precisionToDate(11)).toBe("day");
    expect(precisionToDate(10)).toBe("month");
    expect(precisionToDate(9)).toBe("year");
    expect(precisionToDate(8)).toBeNull();
    expect(precisionToDate(7)).toBeNull();
  });

  it("parses WKT points as lng/lat", () => {
    expect(parseWktPoint("Point(28.97 41.01)")).toEqual([28.97, 41.01]);
    expect(parseWktPoint("Point(-5.8 35.7)")).toEqual([-5.8, 35.7]);
    expect(parseWktPoint("nonsense")).toBeNull();
  });

  it("tags regions by bounding box", () => {
    expect(regionsForPoint([44.8, 41.7])).toEqual(["kafkasya", "osmanli"]); // Tbilisi
    expect(regionsForPoint([66.97, 39.65])).toEqual(["ipek-yolu"]); // Samarkand
    expect(regionsForPoint([-70, 10])).toEqual([]);
  });

  it("removes parentheses left empty by the extract", () => {
    expect(trimToSentence("Gəncə () — şəhərdir ( ; ) və böyükdür.", 100)).toBe("Gəncə — şəhərdir və böyükdür.");
    expect(trimToSentence("Bakü (Azerice: Bakı) başkenttir.", 100)).toBe("Bakü (Azerice: Bakı) başkenttir.");
    expect(trimToSentence("Ganja (; Azerbaijani: Gəncə) is a city.", 100)).toBe("Ganja (Azerbaijani: Gəncə) is a city.");
  });
  it("trims on a sentence boundary when possible", () => {
    expect(trimToSentence("Kısa metin.", 100)).toBe("Kısa metin.");
    expect(trimToSentence("Birinci cümle burada. İkinci cümle çok daha uzun bir metin içerir.", 30)).toBe("Birinci cümle burada.");
    expect(trimToSentence("noktasiz uzun bir metin devam ediyor", 15)).toBe("noktasiz uzun…");
  });
});

describe("selectBalanced", () => {
  const item = (id: string, start_year: number, region: string, score: number, category = "c") => ({ id, category, start_year, region_tags: [region], score });

  it("caps each century and prefers notable items", () => {
    const out = selectBalanced([item("a", 1001, "x", 1), item("b", 1002, "x", 9), item("c", 1003, "x", 5)], { c: 2 });
    expect(out.map((o) => o.id).sort()).toEqual(["b", "c"]);
  });

  it("gives every region a share within a century", () => {
    const items = [item("a", 1001, "x", 100), item("b", 1002, "x", 90), item("c", 1003, "x", 80), item("d", 1004, "y", 1)];
    expect(selectBalanced(items, { c: 2 }).map((o) => o.id).sort()).toEqual(["a", "d"]);
  });

  it("applies quotas per category, so a popular category cannot crowd out others", () => {
    const items = [item("city1", 1001, "x", 900, "city"), item("city2", 1002, "x", 800, "city"), item("battle", 1003, "x", 1, "battle")];
    expect(selectBalanced(items, { city: 1, battle: 1 }).map((o) => o.id).sort()).toEqual(["battle", "city1"]);
  });

  it("drops categories without a quota", () => {
    expect(selectBalanced([item("a", 1001, "x", 1, "none")], {})).toEqual([]);
  });

  it("buckets BCE years separately and sorts by year", () => {
    const out = selectBalanced([item("late", 1500, "x", 1), item("old", -331, "x", 1)], { c: 5 });
    expect(out.map((o) => o.id)).toEqual(["old", "late"]);
  });
});
