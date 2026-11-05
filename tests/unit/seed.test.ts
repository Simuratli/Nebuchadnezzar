import { describe, expect, it } from "vitest";
import events from "../../data/seed/events.json";
import people from "../../data/seed/people.json";
import routes from "../../data/seed/routes.json";
import sources from "../../data/seed/sources.json";
import tours from "../../data/seed/tours.json";
import { eventSchema, personSchema, routeSchema, sourceSchema, tourSchema } from "@/lib/types";
import { MAX_YEAR, MIN_YEAR } from "@/lib/year";

describe("seed data", () => {
  it("satisfies the schemas", () => {
    for (const e of events) eventSchema.parse(e);
    for (const s of sources) sourceSchema.parse(s);
    for (const p of people) personSchema.parse(p);
    for (const r of routes) routeSchema.parse(r);
    for (const t of tours) tourSchema.parse(t);
  });

  it("meets the minimum content targets", () => {
    expect(events.length).toBeGreaterThanOrEqual(150);
    expect(routes.length).toBeGreaterThanOrEqual(3);
    expect(tours.length).toBeGreaterThanOrEqual(1);
    expect(tours[0].steps.length).toBeGreaterThanOrEqual(5);
    expect(tours[0].steps.length).toBeLessThanOrEqual(8);
  });

  it("has unique ids", () => {
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
    expect(new Set(sources.map((s) => s.id)).size).toBe(sources.length);
  });

  it("keeps events inside the supported period", () => {
    for (const e of events) {
      expect(e.start_year).toBeGreaterThanOrEqual(MIN_YEAR);
      expect(e.start_year).toBeLessThanOrEqual(MAX_YEAR);
      if (e.end_year !== null) expect(e.end_year).toBeGreaterThanOrEqual(e.start_year);
    }
  });

  it("gives every event at least one source and no orphan sources", () => {
    const ids = new Set(events.map((e) => e.id));
    const withSource = new Set(sources.map((s) => s.event_id));
    for (const e of events) expect(withSource.has(e.id), e.id).toBe(true);
    for (const s of sources) expect(ids.has(s.event_id), s.id).toBe(true);
  });

  it("flags everything that is not verified Turkish content", () => {
    for (const e of events) {
      if (e.content_lang !== "tr" || !e.summary || e.geometry.type === "LineString") expect(e.needs_review, e.id).toBe(true);
    }
  });

  it("marks hand-written routes and tours for review, with no invented sources", () => {
    for (const r of routes) expect(r.needs_review).toBe(true);
    for (const t of tours) expect(t.needs_review).toBe(true);
    for (const s of sources) expect(s.publisher === "Wikidata" || s.publisher === "Vikipedi" || s.publisher === "Wikipedia", s.id).toBe(true);
  });

  it("has one waypoint per route vertex, in time order and matching position", () => {
    for (const r of routes) {
      expect(r.waypoints.length, r.id).toBe(r.geometry.coordinates.length);
      r.waypoints.forEach((w, i) => {
        expect([w.lng, w.lat], `${r.id} #${i}`).toEqual(r.geometry.coordinates[i]);
        if (i > 0) expect(w.year, `${r.id} #${i}`).toBeGreaterThanOrEqual(r.waypoints[i - 1].year);
      });
    }
  });

  it("links routes to known people and tours to known events", () => {
    const personIds = new Set(people.map((p) => p.id));
    for (const r of routes) if (r.person_id) expect(personIds.has(r.person_id), r.id).toBe(true);
    const eventIds = new Set(events.map((e) => e.id));
    for (const t of tours) for (const s of t.steps) if (s.event_id) expect(eventIds.has(s.event_id), s.title).toBe(true);
  });

  it("links people only to existing events and flags hand-made links", () => {
    const eventIds = new Set(events.map((e) => e.id));
    for (const p of people) {
      for (const l of p.events) expect(eventIds.has(l.event_id), `${p.id} -> ${l.event_id}`).toBe(true);
      if (p.events.some((l) => l.manual)) expect(p.needs_review, p.id).toBe(true);
    }
    expect(people.reduce((n, p) => n + p.events.length, 0)).toBeGreaterThanOrEqual(30);
  });

  it("resolves the people that a name search once mismatched", () => {
    const byId = new Map(people.map((p) => [p.id, p]));
    expect(byId.get("zhang-qian")?.death_year).toBe(-114);
    expect(byId.get("timur")?.birth_year).toBe(1336);
    expect(byId.get("cengiz-han")?.death_year).toBe(1227);
  });

  it("covers every focus region and the BCE period", () => {
    for (const region of ["kafkasya", "osmanli", "ipek-yolu"]) {
      expect(events.filter((e) => (e.region_tags as string[]).includes(region)).length, region).toBeGreaterThanOrEqual(15);
    }
    expect(events.filter((e) => e.start_year < 0).length).toBeGreaterThanOrEqual(5);
  });
});
