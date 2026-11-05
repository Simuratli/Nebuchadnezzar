import { describe, expect, it } from "vitest";
import {
  addYears,
  boundaryForYear,
  clampYear,
  formatYear,
  formatYearRange,
  indexToYear,
  isVisibleAt,
  nextBoundary,
  yearToIndex,
} from "@/lib/year";

describe("year axis", () => {
  it("has no year 0: 1 BCE is followed by 1 CE", () => {
    expect(addYears(-1, 1)).toBe(1);
    expect(addYears(1, -1)).toBe(-1);
    expect(yearToIndex(1) - yearToIndex(-1)).toBe(1);
  });

  it("round-trips every index", () => {
    for (let y = -500; y <= 1950; y++) {
      if (y !== 0) expect(indexToYear(yearToIndex(y))).toBe(y);
    }
  });

  it("clamps to the supported range and never returns 0", () => {
    expect(clampYear(-9999)).toBe(-500);
    expect(clampYear(9999)).toBe(1950);
    expect(clampYear(0)).toBe(1);
    expect(addYears(1950, 10)).toBe(1950);
  });

  it("formats eras", () => {
    expect(formatYear(-331)).toBe("MÖ 331");
    expect(formatYear(1453)).toBe("MS 1453");
    expect(formatYearRange(1914, 1918)).toBe("MS 1914 – MS 1918");
    expect(formatYearRange(1453, null)).toBe("MS 1453");
    expect(formatYearRange(1453, 1453)).toBe("MS 1453");
  });
});

describe("boundaryForYear", () => {
  const manifest = [
    { year: -500, file: "a" },
    { year: -1, file: "b" },
    { year: 100, file: "c" },
    { year: 1945, file: "d" },
  ];

  it("picks the newest file not later than the year", () => {
    expect(boundaryForYear(-500, manifest)?.file).toBe("a");
    expect(boundaryForYear(-2, manifest)?.file).toBe("a");
    expect(boundaryForYear(-1, manifest)?.file).toBe("b");
    expect(boundaryForYear(99, manifest)?.file).toBe("b");
    expect(boundaryForYear(100, manifest)?.file).toBe("c");
    expect(boundaryForYear(1950, manifest)?.file).toBe("d");
  });

  it("falls back to the oldest file before the data starts, and null without data", () => {
    expect(boundaryForYear(-1000, manifest)?.file).toBe("a");
    expect(boundaryForYear(1000, [])).toBeNull();
  });

  it("finds the next file for prefetching", () => {
    expect(nextBoundary(50, manifest)?.file).toBe("c");
    expect(nextBoundary(1950, manifest)).toBeNull();
  });
});

describe("isVisibleAt", () => {
  it("applies the window on both sides", () => {
    expect(isVisibleAt(1453, null, 1453, 0)).toBe(true);
    expect(isVisibleAt(1453, null, 1454, 0)).toBe(false);
    expect(isVisibleAt(1453, null, 1478, 25)).toBe(true);
    expect(isVisibleAt(1453, null, 1479, 25)).toBe(false);
    expect(isVisibleAt(1453, null, 1428, 25)).toBe(true);
  });

  it("covers the full range of multi-year events", () => {
    expect(isVisibleAt(1914, 1918, 1916, 0)).toBe(true);
    expect(isVisibleAt(1914, 1918, 1919, 0)).toBe(false);
  });

  it("counts across the era boundary without a year 0", () => {
    expect(isVisibleAt(-1, null, 1, 1)).toBe(true);
    expect(isVisibleAt(-1, null, 2, 1)).toBe(false);
  });
});
