"use client";

import type { Map as MlMap } from "maplibre-gl";
import { useTranslations } from "next-intl";
import { useEra } from "@/lib/use-era";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPane } from "@/components/map/MapPane";
import { CityPanel } from "@/components/panels/CityPanel";
import { CollectionPanel } from "@/components/panels/CollectionPanel";
import { CorrectionPanel } from "@/components/panels/CorrectionPanel";
import { EventPanel } from "@/components/panels/EventPanel";
import { ExportPanel } from "@/components/panels/ExportPanel";
import { FiltersPanel } from "@/components/panels/FiltersPanel";
import { NavButtons } from "@/components/panels/NavButtons";
import { PersonPanel } from "@/components/panels/PersonPanel";
import { RoutesPanel } from "@/components/panels/RoutesPanel";
import { SearchBox } from "@/components/panels/SearchBox";
import { SidePanel } from "@/components/panels/SidePanel";
import { TourPlayer } from "@/components/panels/TourPlayer";
import { ToursPanel } from "@/components/panels/ToursPanel";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TimeBar, usePlayback } from "@/components/timeline/TimeBar";
import { isCorrectedYear } from "@/lib/corrections";
import { eventsAtYear, filterEvents } from "@/lib/filters";
import type { City, Correction, EventSummary, HistoricalRoute, Person, Tour } from "@/lib/types";
import { serializeUrlState } from "@/lib/url-state";
import { formatYear, type BoundaryEntry } from "@/lib/year";
import { useAtlas } from "@/store/atlas";

export type AtlasData = { events: EventSummary[]; people: Person[]; routes: HistoricalRoute[]; tours: Tour[]; cities: City[]; corrections: Correction[] };

/** Keeps the address bar shareable. replaceState avoids a Next navigation on every change. */
function useUrlSync() {
  useEffect(() => {
    let timer: number | undefined;
    const write = () => {
      const s = useAtlas.getState();
      const qs = serializeUrlState(s);
      if (qs !== window.location.search.slice(1)) {
        window.history.replaceState(null, "", `${window.location.pathname}?${qs}`);
      }
    };
    const unsubscribe = useAtlas.subscribe((s) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(write, s.playing ? 1000 : 200);
    });
    write();
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);
}

/** Mirrors the camera between both compare maps; the guard stops the echo from looping. */
function useSyncedMaps(left: MlMap | null, right: MlMap | null) {
  useEffect(() => {
    if (!left || !right) return;
    let syncing = false;
    const follow = (from: MlMap, to: MlMap) => () => {
      if (syncing) return;
      syncing = true;
      to.jumpTo({ center: from.getCenter(), zoom: from.getZoom() });
      syncing = false;
    };
    const onLeft = follow(left, right);
    const onRight = follow(right, left);
    left.on("move", onLeft);
    right.on("move", onRight);
    onLeft();
    return () => {
      left.off("move", onLeft);
      right.off("move", onRight);
    };
  }, [left, right]);
}

function YearBadge({ yearKey, label }: { yearKey: "year" | "year2"; label: string }) {
  const era = useEra();
  const year = useAtlas((s) => s[yearKey]);
  return (
    <div className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-surface/90 px-2 py-1 text-sm shadow">
      <span className="text-muted">{label}: </span>
      <span className="font-serif font-semibold">{formatYear(year, era)}</span>
    </div>
  );
}

export function AtlasApp({ data }: { data: AtlasData }) {
  const t = useTranslations();
  useUrlSync();
  usePlayback();

  const year = useAtlas((s) => s.year);
  const windowYears = useAtlas((s) => s.windowYears);
  const filters = useAtlas((s) => s.filters);
  const sidePanel = useAtlas((s) => s.sidePanel);
  const compare = useAtlas((s) => s.compare);
  const [leftMap, setLeftMap] = useState<MlMap | null>(null);
  const [rightMap, setRightMap] = useState<MlMap | null>(null);
  useSyncedMaps(leftMap, compare ? rightMap : null);
  const events = useMemo(() => filterEvents(data.events, filters), [data.events, filters]);
  const visibleCount = eventsAtYear(events, year, windowYears).length;

  const [boundary, setBoundary] = useState<{ entry: BoundaryEntry | null; failed: boolean }>({ entry: null, failed: false });
  const onBoundaryChange = useCallback((entry: BoundaryEntry | null, failed: boolean) => setBoundary({ entry, failed }), []);

  const era = useEra();
  const boundaryNote = boundary.failed
    ? t("timeline.boundaryError")
    : boundary.entry
      ? `${t("timeline.boundaryNote", { year: formatYear(boundary.entry.year, era) })} · ${t("map.boundariesApprox")}`
      : "";
  const correctedNote = isCorrectedYear(year) ? ` · ${t("correction.timelineNote")}` : "";
  const note = `${t("timeline.visibleCount", { count: visibleCount })}${boundaryNote ? ` · ${boundaryNote}` : ""}${correctedNote}`;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <a href="#timeline" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded focus:bg-surface focus:p-2">
        {t("app.skipToTimeline")}
      </a>
      <header className="z-40 flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2 md:px-4">
        <h1 className="font-serif text-xl font-semibold">{t("app.title")}</h1>
        {/* Phones: title and settings, then the menu, then search. Desktop: one row. */}
        <div className="order-3 w-full md:order-1 md:ml-4 md:w-auto md:flex-1">
          <SearchBox events={data.events} people={data.people} cities={data.cities} />
        </div>
        <div className="order-2 w-full min-w-0 md:ml-auto md:w-auto">
          <NavButtons />
        </div>
        <div className="order-1 ml-auto flex shrink-0 items-center gap-2 md:order-3 md:ml-0">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative min-h-0 min-w-0 flex-1">
          <MapPane events={events} routes={data.routes} cities={data.cities} corrections={data.corrections} yearKey="year" onBoundaryChange={onBoundaryChange} onMap={setLeftMap} />
          {compare && <YearBadge yearKey="year" label={t("compare.left")} />}
        </div>
        {compare && (
          <div className="relative min-h-0 min-w-0 flex-1 border-t border-line md:border-l md:border-t-0">
            <MapPane events={events} routes={data.routes} cities={data.cities} corrections={data.corrections} yearKey="year2" primary={false} onMap={setRightMap} />
            <YearBadge yearKey="year2" label={t("compare.right")} />
          </div>
        )}
        {sidePanel === "filters" && (
          <SidePanel title={t("filters.title")}>
            <FiltersPanel events={events} />
          </SidePanel>
        )}
        {sidePanel === "collection" && (
          <SidePanel title={t("collection.title")}>
            <CollectionPanel events={data.events} />
          </SidePanel>
        )}
        {sidePanel === "routes" && (
          <SidePanel title={t("routes.title")}>
            <RoutesPanel routes={data.routes} people={data.people} />
          </SidePanel>
        )}
        {sidePanel === "tours" && (
          <SidePanel title={t("tours.title")}>
            <ToursPanel tours={data.tours} />
          </SidePanel>
        )}
        {sidePanel === "export" && (
          <SidePanel title={t("export.title")}>
            <ExportPanel maps={compare ? [leftMap, rightMap] : [leftMap]} />
          </SidePanel>
        )}
        <TourPlayer tours={data.tours} events={data.events} />
        <EventPanel people={data.people} />
        <PersonPanel people={data.people} events={data.events} routes={data.routes} />
        <CityPanel cities={data.cities} events={data.events} />
        <CorrectionPanel corrections={data.corrections} />
      </main>
      <section id="timeline" aria-label={t("timeline.label")} className="z-40 border-t border-line bg-surface px-3 py-2 md:px-4">
        <TimeBar note={note} sliderLabel={compare ? t("timeline.sliderLeft") : undefined} />
        {compare && <TimeBar yearKey="year2" compact sliderLabel={t("timeline.sliderRight")} />}
      </section>
    </div>
  );
}
