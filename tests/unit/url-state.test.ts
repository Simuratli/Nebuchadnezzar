import { describe, expect, it } from "vitest";
import { DEFAULT_URL_STATE, parseUrlState, serializeUrlState } from "@/lib/url-state";

describe("url state", () => {
  it("round-trips a full state", () => {
    const state = { ...DEFAULT_URL_STATE, year: -331, lat: 36.5, lng: 43.25, zoom: 5.5, compare: true, year2: 1071, eventId: "Q123", routeId: "r-1", tourId: "t_1", personId: "ibn-sina", cityId: "gence" };
    expect(parseUrlState(`?${serializeUrlState(state)}`)).toEqual(state);
  });

  it("uses defaults when the URL is empty", () => {
    expect(parseUrlState("")).toEqual(DEFAULT_URL_STATE);
  });

  it("rejects malformed values instead of trusting them", () => {
    const s = parseUrlState("?y=abc&lat=999&lng=-999&z=-1&e=<script>&route=a%20b");
    expect(s.year).toBe(DEFAULT_URL_STATE.year);
    expect(s.lat).toBe(DEFAULT_URL_STATE.lat);
    expect(s.lng).toBe(DEFAULT_URL_STATE.lng);
    expect(s.zoom).toBe(DEFAULT_URL_STATE.zoom);
    expect(s.eventId).toBeNull();
    expect(s.routeId).toBeNull();
  });

  it("clamps years and maps year 0 to 1", () => {
    expect(parseUrlState("?y=-5000").year).toBe(-500);
    expect(parseUrlState("?y=3000").year).toBe(1950);
    expect(parseUrlState("?y=0").year).toBe(1);
  });

  it("omits compare parameters outside compare mode", () => {
    const qs = serializeUrlState(DEFAULT_URL_STATE);
    expect(qs).not.toContain("mode");
    expect(qs).not.toContain("y2");
  });
});
