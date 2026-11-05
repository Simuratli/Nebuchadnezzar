"use client";

import {
  Map as MlMap,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getManifest, loadBoundary } from "@/lib/boundaries";
import { eventsAtYear } from "@/lib/filters";
import { lineBounds, sliceLine } from "@/lib/routes";
import type { EventSummary, HistoricalRoute } from "@/lib/types";
import { boundaryForYear, nextBoundary, type BoundaryEntry } from "@/lib/year";
import { useAtlas } from "@/store/atlas";
import { CLICKABLE_EVENT_LAYERS, installLayers, setSelectedEvent, STYLE_URLS, toEventFeatures } from "./layers";

setWorkerUrl("/maplibre-gl-worker.mjs");

const ROUTE_DURATION_MS = 12_000;
const EMPTY_ROUTE = { line: null as [number, number][] | null, points: [] as GeoJSON.Feature[] };

type Props = {
  events: EventSummary[];
  routes?: HistoricalRoute[];
  yearKey: "year" | "year2";
  /** Only the primary pane writes the view to the store and URL. */
  primary?: boolean;
  onBoundaryChange?: (entry: BoundaryEntry | null, failed: boolean) => void;
  onMap?: (map: MlMap | null) => void;
};

function applyRoute(map: MlMap | null, data: typeof EMPTY_ROUTE) {
  (map?.getSource("route") as GeoJSONSource | undefined)?.setData(
    data.line && data.line.length > 1
      ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: data.line } }
      : { type: "FeatureCollection", features: [] },
  );
  (map?.getSource("route-points") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: data.points });
}

export function MapPane({ events, routes, yearKey, primary = true, onBoundaryChange, onMap }: Props) {
  const t = useTranslations("map");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const boundaryRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const [styleTick, setStyleTick] = useState(0);
  const [manifest, setManifest] = useState<BoundaryEntry[]>([]);

  const year = useAtlas((s) => s[yearKey]);
  const windowYears = useAtlas((s) => s.windowYears);
  const eventId = useAtlas((s) => s.eventId);
  const flyTarget = useAtlas((s) => s.flyTarget);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const darkRef = useRef(dark);
  darkRef.current = dark;

  const visible = useMemo(() => eventsAtYear(events, year, windowYears), [events, year, windowYears]);
  // Clusters are computed from source data, so a visibility change needs setData, not a
  // layer filter. Skipping unchanged sets keeps playback smooth between events.
  const visibleKey = useMemo(() => visible.map((e) => e.id).join(","), [visible]);
  const featuresRef = useRef(toEventFeatures(visible));

  const onMapRef = useRef(onMap);
  onMapRef.current = onMap;
  const routeDataRef = useRef(EMPTY_ROUTE);
  const routeId = useAtlas((s) => s.routeId);
  const routeNonce = useAtlas((s) => s.routeNonce);
  const route = routes?.find((r) => r.id === routeId);

  // Draws the route progressively; passing a stop moves the primary slider to that stop's year.
  useEffect(() => {
    const render = () => applyRoute(mapRef.current, routeDataRef.current);
    const el = containerRef.current;
    if (!route) {
      routeDataRef.current = EMPTY_ROUTE;
      render();
      el?.removeAttribute("data-route-progress");
      return;
    }
    const coords = route.geometry.coordinates;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mapRef.current?.fitBounds(lineBounds(coords), { padding: 70, duration: reduce ? 0 : 900 });

    let frame = 0;
    let lastPassed = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - started) / ROUTE_DURATION_MS);
      const { line, head, passed } = sliceLine(coords, t);
      const stops = route.waypoints.slice(0, passed).map(
        (w): GeoJSON.Feature => ({ type: "Feature", properties: { kind: "stop", place: w.place }, geometry: { type: "Point", coordinates: [w.lng, w.lat] } }),
      );
      const headFeature: GeoJSON.Feature = { type: "Feature", properties: { kind: "head" }, geometry: { type: "Point", coordinates: head } };
      routeDataRef.current = { line, points: t < 1 ? [...stops, headFeature] : stops };
      render();
      if (primary && passed !== lastPassed) {
        lastPassed = passed;
        const stop = route.waypoints[Math.min(passed, route.waypoints.length) - 1];
        if (stop) useAtlas.getState().setYear(stop.year);
      }
      el?.setAttribute("data-route-progress", t.toFixed(2));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [route, routeNonce, primary]);

  useEffect(() => {
    if (!containerRef.current) return;
    const { lng, lat, zoom } = useAtlas.getState();
    const map = new MlMap({
      container: containerRef.current,
      style: STYLE_URLS[darkRef.current ? "dark" : "light"],
      center: [lng, lat],
      zoom,
      minZoom: 1.5,
      maxZoom: 12,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("style.load", () => {
      installLayers(map, darkRef.current);
      if (boundaryRef.current) (map.getSource("boundaries") as GeoJSONSource).setData(boundaryRef.current);
      (map.getSource("events") as GeoJSONSource).setData(featuresRef.current.points);
      (map.getSource("event-lines") as GeoJSONSource).setData(featuresRef.current.lines);
      setSelectedEvent(map, useAtlas.getState().eventId);
      applyRoute(map, routeDataRef.current);
      setStyleTick((n) => n + 1);
    });
    map.on("moveend", () => {
      const c = map.getCenter();
      containerRef.current?.setAttribute("data-center", `${c.lng.toFixed(3)},${c.lat.toFixed(3)}`);
    });
    // The pane resizes when compare mode opens or closes, not only with the window.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);
    // Exposes what actually reached the canvas, so e2e tests cannot pass on an empty map.
    map.on("idle", () => {
      if (!map.getLayer("boundary-fill")) return;
      const el = containerRef.current;
      el?.setAttribute("data-rendered-boundaries", String(map.queryRenderedFeatures({ layers: ["boundary-fill"] }).length));
      el?.setAttribute("data-rendered-icons", String(map.queryRenderedFeatures({ layers: ["event-icon"] }).length));
      const clusters = map.queryRenderedFeatures({ layers: ["event-cluster"] });
      el?.setAttribute("data-rendered-clusters", String(clusters.length));
      const first = clusters[0]?.geometry;
      if (first?.type === "Point") {
        const p = map.project(first.coordinates as [number, number]);
        el?.setAttribute("data-first-cluster", `${Math.round(p.x)},${Math.round(p.y)}`);
      }
      el?.setAttribute("data-rendered-route", String(map.queryRenderedFeatures({ layers: ["route-line"] }).length));
    });
    if (primary) {
      map.on("moveend", () => {
        const c = map.getCenter();
        useAtlas.getState().setView({ lng: c.lng, lat: c.lat, zoom: map.getZoom() });
      });
    }

    const onEventClick = (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id) useAtlas.getState().selectEvent(id);
    };
    const onClusterClick = async (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (feature?.geometry.type !== "Point") return;
      const source = map.getSource("events") as GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id as number);
      map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom: zoom + 0.2 });
    };
    for (const layer of CLICKABLE_EVENT_LAYERS) {
      map.on("click", layer, onEventClick);
      map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
    }
    map.on("click", "event-cluster", onClusterClick);
    map.on("mouseenter", "event-cluster", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "event-cluster", () => (map.getCanvas().style.cursor = ""));

    mapRef.current = map;
    onMapRef.current?.(map);
    return () => {
      resizeObserver.disconnect();
      onMapRef.current?.(null);
      map.remove();
      mapRef.current = null;
    };
  }, [primary]);

  // Theme switch: setStyle drops custom layers, and style.load puts them back.
  const appliedTheme = useRef(dark);
  useEffect(() => {
    if (appliedTheme.current === dark) return;
    appliedTheme.current = dark;
    mapRef.current?.setStyle(STYLE_URLS[dark ? "dark" : "light"], { diff: false });
  }, [dark]);

  useEffect(() => {
    getManifest()
      .then(setManifest)
      .catch(() => onBoundaryChange?.(null, true));
  }, [onBoundaryChange]);

  // Boundaries reload only when the year crosses into a different file.
  const entry = boundaryForYear(year, manifest);
  const file = entry?.file;
  const entryYear = entry?.year;
  const upcoming = nextBoundary(year, manifest)?.file;
  useEffect(() => {
    if (!file || entryYear === undefined) return;
    let stale = false;
    loadBoundary(file)
      .then((fc) => {
        if (stale) return;
        boundaryRef.current = fc;
        (mapRef.current?.getSource("boundaries") as GeoJSONSource | undefined)?.setData(fc);
        onBoundaryChange?.({ file, year: entryYear }, false);
      })
      .catch(() => {
        if (!stale) onBoundaryChange?.(null, true);
      });
    return () => {
      stale = true;
    };
  }, [file, entryYear, onBoundaryChange]);

  // Prefetch so playback does not stall at the next file boundary.
  useEffect(() => {
    if (upcoming) loadBoundary(upcoming).catch(() => undefined);
  }, [upcoming]);

  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  useEffect(() => {
    featuresRef.current = toEventFeatures(visibleRef.current);
    const map = mapRef.current;
    (map?.getSource("events") as GeoJSONSource | undefined)?.setData(featuresRef.current.points);
    (map?.getSource("event-lines") as GeoJSONSource | undefined)?.setData(featuresRef.current.lines);
  }, [visibleKey]);

  useEffect(() => {
    if (mapRef.current) setSelectedEvent(mapRef.current, eventId);
  }, [eventId]);

  useEffect(() => {
    if (!flyTarget || !primary) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const options = { center: [flyTarget.lng, flyTarget.lat] as [number, number], zoom: flyTarget.zoom };
    if (reduce) mapRef.current?.jumpTo(options);
    else mapRef.current?.flyTo({ ...options, duration: 1400, essential: false });
  }, [flyTarget, primary]);

  return (
    // MapLibre's stylesheet forces position:relative on its container, so the
    // absolute positioning has to live on a wrapper.
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        role="application"
        aria-label={t("label")}
        data-testid={`map-${yearKey}`}
        data-style-tick={styleTick}
        data-boundary-year={entryYear ?? ""}
        data-visible-events={visible.length}
        className="h-full w-full"
      />
    </div>
  );
}
