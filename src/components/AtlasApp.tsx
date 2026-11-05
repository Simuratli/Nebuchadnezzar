"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { MapPane } from "@/components/map/MapPane";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TimeBar, usePlayback } from "@/components/timeline/TimeBar";
import type { EventSummary } from "@/lib/types";
import { serializeUrlState } from "@/lib/url-state";
import { formatYear, type BoundaryEntry } from "@/lib/year";
import { useAtlas } from "@/store/atlas";

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

const NO_EVENTS: EventSummary[] = [];

export function AtlasApp() {
  const t = useTranslations();
  useUrlSync();
  usePlayback();

  const [boundary, setBoundary] = useState<{ entry: BoundaryEntry | null; failed: boolean }>({ entry: null, failed: false });
  const onBoundaryChange = useCallback((entry: BoundaryEntry | null, failed: boolean) => setBoundary({ entry, failed }), []);

  const era = { bc: t("era.bc"), ad: t("era.ad") };
  const note = boundary.failed
    ? t("timeline.boundaryError")
    : boundary.entry
      ? `${t("timeline.boundaryNote", { year: formatYear(boundary.entry.year, era) })} · ${t("map.boundariesApprox")}`
      : undefined;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <a href="#timeline" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded focus:bg-surface focus:p-2">
        {t("app.skipToTimeline")}
      </a>
      <header className="z-20 flex items-center gap-3 border-b border-line bg-surface px-4 py-2">
        <h1 className="font-serif text-xl font-semibold">{t("app.title")}</h1>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>
      <main className="relative min-h-0 flex-1">
        <MapPane events={NO_EVENTS} yearKey="year" onBoundaryChange={onBoundaryChange} />
      </main>
      <section id="timeline" aria-label={t("timeline.label")} className="z-20 border-t border-line bg-surface px-4 py-2">
        <TimeBar note={note} />
      </section>
    </div>
  );
}
