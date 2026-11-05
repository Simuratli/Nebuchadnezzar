import type { Feature, FeatureCollection } from "geojson";
import type { Map as MlMap } from "maplibre-gl";
import { CATEGORY_META, iconImageId } from "@/lib/categories";
import { CATEGORIES, type EventSummary } from "@/lib/types";

export const STYLE_URLS = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

export const BOUNDARY_ATTRIBUTION =
  '<a href="https://github.com/aourednik/historical-basemaps" target="_blank" rel="noreferrer">historical-basemaps</a> (GPL-3.0)';

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

export const CLICKABLE_EVENT_LAYERS = ["event-icon", "event-line-hit"];

/**
 * Modern borders, country names, roads and buildings contradict a historical
 * map, so only terrain, water and place names survive from the basemap.
 */
const HIDDEN_BASEMAP = /^(boundary|label_country|place_country|label_state|place_state|highway|road|railway|tunnel|aeroway|building|airport)/;

function prepareBasemap(map: MlMap, dark: boolean) {
  for (const layer of map.getStyle().layers ?? []) {
    if (HIDDEN_BASEMAP.test(layer.id)) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    } else if (layer.type === "symbol") {
      // Today's city names help orientation but must not read as period names.
      map.setPaintProperty(layer.id, "text-opacity", 0.5);
    }
  }
  if (!dark) {
    if (map.getLayer("background")) map.setPaintProperty("background", "background-color", "#f2f3f0");
    if (map.getLayer("water")) map.setPaintProperty("water", "fill-color", "#c9d9e3");
  }
}

function firstSymbolLayer(map: MlMap): string | undefined {
  return map.getStyle().layers?.find((l) => l.type === "symbol" && l.layout?.visibility !== "none")?.id;
}

/** Draws a coloured disc with a white glyph; pixelRatio 2 keeps it sharp on any screen. */
function drawCategoryIcon(color: string, path: string): ImageData | null {
  const size = 56;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.translate(size / 2 - 16, size / 2 - 16);
  ctx.scale(32 / 24, 32 / 24);
  ctx.fillStyle = "#ffffff";
  ctx.fill(new Path2D(path));
  return ctx.getImageData(0, 0, size, size);
}

function addIcons(map: MlMap) {
  for (const category of CATEGORIES) {
    const id = iconImageId(category);
    if (map.hasImage(id)) continue;
    const image = drawCategoryIcon(CATEGORY_META[category].color, CATEGORY_META[category].icon);
    if (image) map.addImage(id, image, { pixelRatio: 2 });
  }
}

/** Creates every custom source and layer. Runs on each style.load because setStyle removes them. */
export function installLayers(map: MlMap, dark: boolean) {
  prepareBasemap(map, dark);
  addIcons(map);
  const before = firstSymbolLayer(map);

  map.addSource("boundaries", { type: "geojson", data: EMPTY, attribution: BOUNDARY_ATTRIBUTION });
  map.addLayer(
    {
      id: "boundary-fill",
      type: "fill",
      source: "boundaries",
      paint: { "fill-color": ["get", "color"], "fill-opacity": dark ? 0.26 : 0.22 },
    },
    before,
  );
  // BORDERPRECISION 1 means approximate in the dataset; show that as a dashed line.
  map.addLayer(
    {
      id: "boundary-line-approx",
      type: "line",
      source: "boundaries",
      filter: ["==", ["get", "BORDERPRECISION"], 1],
      paint: { "line-color": ["get", "color"], "line-width": 1, "line-dasharray": [3, 2], "line-opacity": 0.8 },
    },
    before,
  );
  map.addLayer(
    {
      id: "boundary-line",
      type: "line",
      source: "boundaries",
      filter: ["!=", ["get", "BORDERPRECISION"], 1],
      paint: { "line-color": ["get", "color"], "line-width": 1.2, "line-opacity": 0.9 },
    },
    before,
  );
  map.addLayer({
    id: "boundary-label",
    type: "symbol",
    source: "boundaries",
    layout: {
      "text-field": ["get", "NAME"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 12,
      "text-max-width": 8,
      "text-padding": 8,
    },
    paint: {
      "text-color": dark ? "#dfe6ec" : "#26323f",
      "text-halo-color": dark ? "#0e141b" : "#ffffff",
      "text-halo-width": 1.4,
    },
  });

  // Fill only. The groups are today's admin units, so outlining them would draw internal
  // borders that did not exist; neighbours under one polity blend into a single colour.
  map.addSource("corrections", { type: "geojson", data: EMPTY, attribution: "Natural Earth" });
  map.addLayer(
    {
      id: "correction-fill",
      type: "fill",
      source: "corrections",
      // Antialiasing would show the shared edges of neighbouring groups as faint lines.
      paint: { "fill-color": ["get", "color"], "fill-opacity": dark ? 0.26 : 0.22, "fill-antialias": false },
    },
    before,
  );
  map.addLayer({
    id: "correction-label",
    type: "symbol",
    source: "corrections",
    filter: ["==", ["get", "label"], true],
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 12,
      "text-max-width": 8,
      "text-padding": 8,
    },
    paint: {
      "text-color": dark ? "#dfe6ec" : "#26323f",
      "text-halo-color": dark ? "#0e141b" : "#ffffff",
      "text-halo-width": 1.4,
    },
  });

  map.addSource("cities", { type: "geojson", data: EMPTY });
  map.addLayer({
    id: "city-dot",
    type: "circle",
    source: "cities",
    // Same threshold as the label: an unnamed dot tells the reader nothing.
    minzoom: 4,
    paint: {
      "circle-radius": 3.5,
      "circle-color": dark ? "#e8edf2" : "#16202c",
      "circle-stroke-width": 1.5,
      "circle-stroke-color": dark ? "#0e141b" : "#ffffff",
    },
  });
  map.addLayer({
    id: "city-label",
    type: "symbol",
    source: "cities",
    minzoom: 4,
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 12,
      "text-anchor": "top",
      "text-offset": [0, 0.5],
      "text-optional": true,
    },
    paint: {
      "text-color": dark ? "#e8edf2" : "#16202c",
      "text-halo-color": dark ? "#0e141b" : "#ffffff",
      "text-halo-width": 1.5,
    },
  });

  map.addSource("route", { type: "geojson", data: EMPTY });
  map.addSource("route-points", { type: "geojson", data: EMPTY });
  map.addLayer({
    id: "route-casing",
    type: "line",
    source: "route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": dark ? "#0e141b" : "#ffffff", "line-width": 6 },
  });
  map.addLayer({
    id: "route-line",
    type: "line",
    source: "route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": dark ? "#5fbcd9" : "#0f5c78", "line-width": 3 },
  });
  map.addLayer({
    id: "route-stops",
    type: "circle",
    source: "route-points",
    filter: ["!=", ["get", "kind"], "head"],
    paint: {
      "circle-radius": 4.5,
      "circle-color": dark ? "#5fbcd9" : "#0f5c78",
      "circle-stroke-width": 1.5,
      "circle-stroke-color": dark ? "#0e141b" : "#ffffff",
    },
  });
  map.addLayer({
    id: "route-stop-label",
    type: "symbol",
    source: "route-points",
    filter: ["!=", ["get", "kind"], "head"],
    layout: {
      "text-field": ["get", "place"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 12,
      "text-anchor": "bottom",
      "text-offset": [0, -0.6],
    },
    paint: {
      "text-color": dark ? "#e8edf2" : "#16202c",
      "text-halo-color": dark ? "#0e141b" : "#ffffff",
      "text-halo-width": 1.5,
    },
  });
  map.addLayer({
    id: "route-head",
    type: "circle",
    source: "route-points",
    filter: ["==", ["get", "kind"], "head"],
    paint: { "circle-radius": 7, "circle-color": dark ? "#ffffff" : "#16202c", "circle-stroke-width": 2, "circle-stroke-color": dark ? "#0e141b" : "#ffffff" },
  });

  // Line events (migrations) cannot be clustered, so they use their own source.
  map.addSource("event-lines", { type: "geojson", data: EMPTY });
  map.addLayer({
    id: "event-line",
    type: "line",
    source: "event-lines",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ["get", "color"], "line-width": 3, "line-opacity": 0.85 },
  });
  map.addLayer({
    id: "event-line-hit",
    type: "line",
    source: "event-lines",
    paint: { "line-color": "#000000", "line-width": 14, "line-opacity": 0 },
  });

  map.addSource("events", {
    type: "geojson",
    data: EMPTY,
    cluster: true,
    clusterRadius: 42,
    clusterMaxZoom: 8,
  });
  map.addLayer({
    id: "event-cluster",
    type: "circle",
    source: "events",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": dark ? "#5fbcd9" : "#0f5c78",
      "circle-radius": ["step", ["get", "point_count"], 14, 5, 18, 15, 23],
      "circle-stroke-width": 2,
      "circle-stroke-color": dark ? "#0e141b" : "#ffffff",
    },
  });
  map.addLayer({
    id: "event-cluster-count",
    type: "symbol",
    source: "events",
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 13,
      "text-allow-overlap": true,
    },
    paint: { "text-color": dark ? "#08222c" : "#ffffff" },
  });
  map.addLayer({
    id: "event-selected",
    type: "circle",
    source: "events",
    filter: ["==", ["get", "id"], ""],
    paint: {
      "circle-radius": 20,
      "circle-color": "rgba(0,0,0,0)",
      "circle-stroke-width": 3,
      "circle-stroke-color": dark ? "#ffffff" : "#16202c",
    },
  });
  map.addLayer({
    id: "event-icon",
    type: "symbol",
    source: "events",
    filter: ["!", ["has", "point_count"]],
    layout: {
      "icon-image": ["get", "icon"],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "text-field": ["get", "title"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 12,
      "text-anchor": "top",
      "text-offset": [0, 1.3],
      "text-max-width": 10,
      "text-optional": true,
    },
    paint: {
      "text-color": dark ? "#e8edf2" : "#16202c",
      "text-halo-color": dark ? "#0e141b" : "#ffffff",
      "text-halo-width": 1.5,
      "text-opacity": ["step", ["zoom"], 0, 5, 1],
    },
  });
}

export function setSelectedEvent(map: MlMap, id: string | null) {
  if (map.getLayer("event-selected")) map.setFilter("event-selected", ["==", ["get", "id"], id ?? ""]);
}

/** Splits events by geometry. Only fields used by layers go in, as tiles carry every property. */
export function toEventFeatures(events: EventSummary[]): { points: FeatureCollection; lines: FeatureCollection } {
  const points: Feature[] = [];
  const lines: Feature[] = [];
  for (const e of events) {
    const properties = { id: e.id, title: e.title, icon: iconImageId(e.category), color: CATEGORY_META[e.category].color };
    (e.geometry.type === "Point" ? points : lines).push({ type: "Feature", geometry: e.geometry, properties });
  }
  return { points: { type: "FeatureCollection", features: points }, lines: { type: "FeatureCollection", features: lines } };
}
