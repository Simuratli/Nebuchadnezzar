import type { Feature, FeatureCollection } from "geojson";
import type { EventSummary } from "./types";

/**
 * Quotes per RFC 4180 and neutralises spreadsheet formulas: a cell starting
 * with = + - @ tab or CR would otherwise execute when opened in Excel.
 */
export function csvCell(value: string | number | boolean | null): string {
  if (value === null) return "";
  if (typeof value !== "string") return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const firstPoint = (e: EventSummary) => (e.geometry.type === "Point" ? e.geometry.coordinates : e.geometry.coordinates[0]);

export function eventsToCsv(events: EventSummary[]): string {
  const header = ["id", "title", "start_year", "end_year", "date_precision", "category", "regions", "lng", "lat", "wikidata_id", "needs_review", "summary"];
  const rows = events.map((e) => {
    const [lng, lat] = firstPoint(e);
    return [e.id, e.title, e.start_year, e.end_year, e.date_precision, e.category, e.region_tags.join("|"), lng, lat, e.wikidata_id, e.needs_review, e.summary]
      .map(csvCell)
      .join(",");
  });
  // The BOM makes Excel read the file as UTF-8, keeping Turkish characters intact.
  return `﻿${[header.join(","), ...rows].join("\r\n")}\r\n`;
}

export function eventsToGeoJson(events: EventSummary[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: events.map((e): Feature => {
      const { geometry, ...properties } = e;
      return { type: "Feature", id: e.id, geometry, properties };
    }),
  };
}

export function downloadText(filename: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
