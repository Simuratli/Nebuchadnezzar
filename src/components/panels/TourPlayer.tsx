"use client";

import { useTranslations } from "next-intl";
import { useEra } from "@/lib/use-era";
import { useEffect } from "react";
import type { EventSummary, Tour } from "@/lib/types";
import { formatYear } from "@/lib/year";
import { useAtlas } from "@/store/atlas";

export function TourPlayer({ tours, events }: { tours: Tour[]; events: EventSummary[] }) {
  const t = useTranslations();
  const era = useEra();
  const tourId = useAtlas((s) => s.tourId);
  const stepIndex = useAtlas((s) => s.tourStep);
  const setTourStep = useAtlas((s) => s.setTourStep);
  const endTour = useAtlas((s) => s.endTour);
  const tour = tours.find((x) => x.id === tourId);
  const step = tour?.steps[stepIndex];

  useEffect(() => {
    if (!step) return;
    const atlas = useAtlas.getState();
    atlas.setYear(step.year);
    atlas.flyTo(step.view);
  }, [step]);

  if (!tour || !step) return null;
  const last = stepIndex === tour.steps.length - 1;
  const linked = step.event_id ? events.find((e) => e.id === step.event_id) : undefined;

  return (
    <section
      aria-label={tour.title}
      data-testid="tour-player"
      className="floating-card absolute inset-x-2 bottom-[calc(var(--timeline-h,90px)+16px)] z-30 p-4 md:inset-x-auto md:left-3 md:w-[420px]"
    >
      <div className="flex items-baseline justify-between gap-2 text-xs text-muted">
        <span>{tour.title}</span>
        <span data-testid="tour-progress">{t("tours.step", { current: stepIndex + 1, total: tour.steps.length })}</span>
      </div>
      <h2 data-testid="tour-step-title" className="mt-1 font-serif text-xl font-semibold">
        {step.title}
      </h2>
      <p className="text-sm font-medium text-muted">{formatYear(step.year, era)}</p>
      <p className="mt-2 text-sm leading-relaxed" aria-live="polite">
        {step.text}
      </p>
      {linked && (
        <button type="button" onClick={() => useAtlas.getState().selectEvent(linked.id)} data-testid="tour-event" className="mt-2 text-sm text-accent underline">
          {linked.title}
        </button>
      )}
      {tour.needs_review && <p className="mt-2 rounded bg-warn-bg px-2 py-1 text-xs text-warn-ink">{t("tours.reviewNote")}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={stepIndex === 0}
          onClick={() => setTourStep(stepIndex - 1)}
          data-testid="tour-prev"
          className="rounded border border-line px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50"
        >
          {t("tours.prev")}
        </button>
        <button
          type="button"
          onClick={() => (last ? endTour() : setTourStep(stepIndex + 1))}
          data-testid="tour-next"
          className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink"
        >
          {last ? t("tours.finish") : t("tours.next")}
        </button>
        {!last && (
          <button type="button" onClick={endTour} data-testid="tour-exit" className="ml-auto text-xs text-accent underline">
            {t("app.close")}
          </button>
        )}
      </div>
    </section>
  );
}
