"use client";

import { useEra } from "@/lib/use-era";
import { CATEGORY_META } from "@/lib/categories";
import type { EventSummary } from "@/lib/types";
import { formatYearRange } from "@/lib/year";
import { useAtlas } from "@/store/atlas";

/** Compact clickable event list used by the city and person pages. */
export function EventList({ events, testId, tag }: { events: EventSummary[]; testId: string; tag?: (e: EventSummary) => string | null }) {
  const era = useEra();
  const openEvent = useAtlas((s) => s.openEvent);
  return (
    <ul className="divide-y divide-line text-sm">
      {events.map((e) => (
        <li key={e.id}>
          <button type="button" onClick={() => openEvent(e)} data-testid={testId} className="flex w-full items-start gap-2 py-1.5 text-left hover:bg-surface-2">
            <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: CATEGORY_META[e.category].color }} />
            <span className="min-w-0 flex-1">
              {e.title}
              {tag?.(e) && <span className="ml-1 text-xs text-muted">({tag(e)})</span>}
            </span>
            <span className="shrink-0 text-xs text-muted">{formatYearRange(e.start_year, e.end_year, era)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
