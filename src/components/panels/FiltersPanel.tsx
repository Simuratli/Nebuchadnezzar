"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { CATEGORY_META } from "@/lib/categories";
import { downloadText, eventsToCsv, eventsToGeoJson } from "@/lib/export";
import { hasActiveFilters } from "@/lib/filters";
import { CATEGORIES, REGIONS, type Category, type EventSummary, type Region } from "@/lib/types";
import { clampYear, formatYearRange } from "@/lib/year";
import { useAtlas } from "@/store/atlas";

const PAGE = 40;

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/** Empty or non-numeric input clears the bound; year 0 does not exist and maps to 1. */
function parseYear(text: string): number | null {
  const n = Number(text);
  return text.trim() === "" || !Number.isFinite(n) ? null : clampYear(n);
}

function YearInput({ label, value, onChange, testId }: { label: string; value: number | null; onChange: (v: number | null) => void; testId: string }) {
  const [text, setText] = useState(value === null ? "" : String(value));
  // Filters can be cleared from outside; resync the field without an effect.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(value === null ? "" : String(value));
  }
  return (
    <label className="flex-1 text-xs text-muted">
      {label}
      <input
        type="number"
        inputMode="numeric"
        value={text}
        data-testid={testId}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(parseYear(text))}
        onKeyDown={(e) => {
          if (e.key === "Enter") onChange(parseYear(text));
        }}
        className="mt-1 w-full rounded border border-line bg-bg px-2 py-1 text-sm text-ink"
      />
    </label>
  );
}

export function FiltersPanel({ events }: { events: EventSummary[] }) {
  const t = useTranslations();
  const era = { bc: t("era.bc"), ad: t("era.ad") };
  const filters = useAtlas((s) => s.filters);
  const setFilters = useAtlas((s) => s.setFilters);
  const clearFilters = useAtlas((s) => s.clearFilters);
  const openEvent = useAtlas((s) => s.openEvent);
  const [shown, setShown] = useState(PAGE);
  const sorted = useMemo(() => [...events].sort((a, b) => a.start_year - b.start_year), [events]);

  return (
    <div className="space-y-5 text-sm" data-testid="filters-panel">
      <fieldset>
        <legend className="mb-1 font-medium">{t("filters.category")}</legend>
        <div className="grid grid-cols-2 gap-1">
          {CATEGORIES.map((c: Category) => (
            <label key={c} className="flex items-center gap-2 py-0.5">
              <input
                type="checkbox"
                checked={filters.categories.includes(c)}
                onChange={() => setFilters({ categories: toggle(filters.categories, c) })}
                data-testid={`filter-cat-${c}`}
              />
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_META[c].color }} />
              {t(`categories.${c}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 font-medium">{t("filters.region")}</legend>
        {REGIONS.map((r: Region) => (
          <label key={r} className="flex items-center gap-2 py-0.5">
            <input
              type="checkbox"
              checked={filters.regions.includes(r)}
              onChange={() => setFilters({ regions: toggle(filters.regions, r) })}
              data-testid={`filter-region-${r}`}
            />
            {t(`regions.${r}`)}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend className="mb-1 font-medium">{t("filters.yearRange")}</legend>
        <div className="flex gap-2">
          <YearInput label={t("filters.from")} value={filters.from} onChange={(from) => setFilters({ from })} testId="filter-from" />
          <YearInput label={t("filters.to")} value={filters.to} onChange={(to) => setFilters({ to })} testId="filter-to" />
        </div>
        <p className="mt-1 text-xs text-muted">{t("filters.yearHint")}</p>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <span data-testid="filter-count" aria-live="polite" className="font-medium">
          {t("filters.results", { count: events.length })}
        </span>
        {hasActiveFilters(filters) && (
          <button type="button" onClick={clearFilters} data-testid="filter-clear" className="ml-auto text-xs text-accent underline">
            {t("filters.clear")}
          </button>
        )}
      </div>

      <div>
        <p className="mb-1 font-medium">{t("filters.export")}</p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={events.length === 0}
            data-testid="export-csv"
            onClick={() => downloadText("zaman-atlasi-olaylar.csv", eventsToCsv(events), "text/csv;charset=utf-8")}
            className="rounded border border-line px-3 py-1.5 hover:bg-surface-2 disabled:opacity-50"
          >
            {t("filters.exportCsv")}
          </button>
          <button
            type="button"
            disabled={events.length === 0}
            data-testid="export-geojson"
            onClick={() => downloadText("zaman-atlasi-olaylar.geojson", JSON.stringify(eventsToGeoJson(events), null, 1), "application/geo+json")}
            className="rounded border border-line px-3 py-1.5 hover:bg-surface-2 disabled:opacity-50"
          >
            {t("filters.exportGeoJson")}
          </button>
        </div>
      </div>

      {/* Map markers live on a canvas; this list is the keyboard and screen reader route to every event. */}
      <div>
        <p className="mb-1 font-medium">{t("filters.list")}</p>
        <ul className="divide-y divide-line">
          {sorted.slice(0, shown).map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => openEvent(e)} data-testid="filter-result" className="flex w-full items-start gap-2 py-1.5 text-left hover:bg-surface-2">
                <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: CATEGORY_META[e.category].color }} />
                <span className="min-w-0 flex-1">{e.title}</span>
                <span className="shrink-0 text-xs text-muted">{formatYearRange(e.start_year, e.end_year, era)}</span>
              </button>
            </li>
          ))}
        </ul>
        {shown < sorted.length && (
          <button type="button" onClick={() => setShown((n) => n + PAGE)} className="mt-2 text-xs text-accent underline">
            {t("filters.showMore")}
          </button>
        )}
      </div>
    </div>
  );
}
