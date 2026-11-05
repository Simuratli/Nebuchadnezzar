"use client";

import { useTranslations } from "next-intl";
import type { Tour } from "@/lib/types";
import { useAtlas } from "@/store/atlas";

export function ToursPanel({ tours }: { tours: Tour[] }) {
  const t = useTranslations("tours");
  const startTour = useAtlas((s) => s.startTour);
  return (
    <div className="space-y-3 text-sm" data-testid="tours-panel">
      {tours.map((tour) => (
        <article key={tour.id} className="rounded border border-line p-3">
          <h3 className="font-serif text-base font-semibold">{tour.title}</h3>
          <p className="mt-1 text-muted">{tour.description}</p>
          <button type="button" onClick={() => startTour(tour.id)} data-testid={`tour-start-${tour.id}`} className="mt-2 rounded bg-accent px-3 py-1.5 font-medium text-accent-ink">
            {t("start")}
          </button>
        </article>
      ))}
    </div>
  );
}
