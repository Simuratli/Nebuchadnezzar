"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPane } from "@/components/map/MapPane";
import { CollectionPanel } from "@/components/panels/CollectionPanel";
import { EventPanel } from "@/components/panels/EventPanel";
import { FiltersPanel } from "@/components/panels/FiltersPanel";
import { NavButtons } from "@/components/panels/NavButtons";
import { SearchBox } from "@/components/panels/SearchBox";
import { SidePanel } from "@/components/panels/SidePanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TimeBar, usePlayback } from "@/components/timeline/TimeBar";
import { eventsAtYear, filterEvents } from "@/lib/filters";
import type { EventSummary, HistoricalRoute, Person, Tour } from "@/lib/types";
import { serializeUrlState } from "@/lib/url-state";
import { formatYear, type BoundaryEntry } from "@/lib/year";
import { useAtlas } from "@/store/atlas";

export type AtlasData = { events: EventSummary[]; people: Person[]; routes: HistoricalRoute[]; tours: Tour[] };

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

export function AtlasApp({ data }: { data: AtlasData }) {
  const t = useTranslations();
  useUrlSync();
  usePlayback();

  const year = useAtlas((s) => s.year);
  const windowYears = useAtlas((s) => s.windowYears);
  const filters = useAtlas((s) => s.filters);
  const sidePanel = useAtlas((s) => s.sidePanel);
  const events = useMemo(() => filterEvents(data.events, filters), [data.events, filters]);
  const visibleCount = eventsAtYear(events, year, windowYears).length;

  const [boundary, setBoundary] = useState<{ entry: BoundaryEntry | null; failed: boolean }>({ entry: null, failed: false });
  const onBoundaryChange = useCallback((entry: BoundaryEntry | null, failed: boolean) => setBoundary({ entry, failed }), []);

  const era = { bc: t("era.bc"), ad: t("era.ad") };
  const boundaryNote = boundary.failed
    ? t("timeline.boundaryError")
    : boundary.entry
      ? `${t("timeline.boundaryNote", { year: formatYear(boundary.entry.year, era) })} · ${t("map.boundariesApprox")}`
      : "";
  const note = `${t("timeline.visibleCount", { count: visibleCount })}${boundaryNote ? ` · ${boundaryNote}` : ""}`;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <a href="#timeline" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded focus:bg-surface focus:p-2">
        {t("app.skipToTimeline")}
      </a>
      <header className="z-40 flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2 md:px-4">
        <h1 className="font-serif text-xl font-semibold">{t("app.title")}</h1>
        <div className="order-last w-full md:order-none md:ml-4 md:w-auto md:flex-1">
          <SearchBox events={data.events} people={data.people} routes={data.routes} />
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <NavButtons />
          <ThemeToggle />
        </div>
      </header>
      <main className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative min-h-0 min-w-0 flex-1">
          <MapPane events={events} routes={data.routes} yearKey="year" onBoundaryChange={onBoundaryChange} />
        </div>
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
        <EventPanel />
      </main>
      <section id="timeline" aria-label={t("timeline.label")} className="z-40 border-t border-line bg-surface px-3 py-2 md:px-4">
        <TimeBar note={note} />
      </section>
    </div>
  );
}
