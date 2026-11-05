"use client";

import { useTranslations } from "next-intl";
import type { HistoricalRoute, Person } from "@/lib/types";
import { formatYear, formatYearRange } from "@/lib/year";
import { useAtlas } from "@/store/atlas";

export function RoutesPanel({ routes, people }: { routes: HistoricalRoute[]; people: Person[] }) {
  const t = useTranslations();
  const era = { bc: t("era.bc"), ad: t("era.ad") };
  const routeId = useAtlas((s) => s.routeId);
  const setRoute = useAtlas((s) => s.setRoute);
  const replayRoute = useAtlas((s) => s.replayRoute);
  const flyTo = useAtlas((s) => s.flyTo);

  return (
    <div className="space-y-3 text-sm" data-testid="routes-panel">
      {routes.map((route) => {
        const active = route.id === routeId;
        const person = people.find((p) => p.id === route.person_id);
        return (
          <article key={route.id} className="rounded border border-line p-3" data-testid="route-item">
            <h3 className="font-serif text-base font-semibold">{route.title}</h3>
            <p className="text-xs text-muted">
              {person && `${person.name} · `}
              {formatYearRange(route.start_year, route.end_year, era)}
            </p>
            {route.needs_review && <p className="mt-2 rounded bg-warn-bg px-2 py-1 text-xs text-warn-ink">{t("routes.reviewNote")} {t("routes.noSource")}</p>}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => (active ? replayRoute() : setRoute(route.id))}
                data-testid={`route-play-${route.id}`}
                className="rounded bg-accent px-3 py-1.5 font-medium text-accent-ink"
              >
                {active ? t("routes.replay") : t("routes.play")}
              </button>
              {active && (
                <button type="button" onClick={() => setRoute(null)} data-testid="route-stop" className="rounded border border-line px-3 py-1.5 hover:bg-surface-2">
                  {t("routes.stop")}
                </button>
              )}
            </div>
            {active && (
              <>
                <h4 className="mt-3 font-medium">{t("routes.waypoints")}</h4>
                <ol className="mt-1 divide-y divide-line" data-testid="route-waypoints">
                  {route.waypoints.map((w, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => {
                          useAtlas.getState().setYear(w.year);
                          flyTo({ lng: w.lng, lat: w.lat });
                        }}
                        className="w-full py-1.5 text-left hover:bg-surface-2"
                      >
                        <span className="font-medium">{w.place}</span> <span className="text-xs text-muted">{formatYear(w.year, era)}</span>
                        <span className="block text-xs text-muted">{w.note}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
