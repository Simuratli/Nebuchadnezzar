"use client";

import { useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState } from "react";
import { CATEGORY_META } from "@/lib/categories";
import { createSearch, type SearchResult } from "@/lib/search";
import type { City, EventSummary, HistoricalRoute, Person } from "@/lib/types";
import { formatYear, formatYearRange } from "@/lib/year";
import { useAtlas } from "@/store/atlas";

type Props = { events: EventSummary[]; people: Person[]; routes: HistoricalRoute[]; cities: City[] };

export function SearchBox({ events, people, routes, cities }: Props) {
  const t = useTranslations();
  const era = { bc: t("era.bc"), ad: t("era.ad") };
  const listId = useId();
  const search = useMemo(() => createSearch(events, people, cities), [events, people, cities]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => search(query, 10), [search, query]);
  const showList = open && query.trim().length >= 2;

  const choose = (result: SearchResult) => {
    const atlas = useAtlas.getState();
    if (result.kind === "event") {
      atlas.openEvent(result.item);
    } else if (result.kind === "city") {
      atlas.selectCity(result.item.id);
      atlas.flyTo({ lng: result.item.lng, lat: result.item.lat });
    } else {
      // A person with a route goes straight to it; others jump to their lifetime.
      const route = routes.find((r) => r.person_id === result.item.id);
      if (route) {
        atlas.setSidePanel("routes");
        atlas.setRoute(route.id);
      } else {
        const { birth_year: b, death_year: d } = result.item;
        const year = b !== null && d !== null ? Math.round((b + d) / 2) : (b ?? d);
        if (year !== null) atlas.setYear(year);
      }
    }
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      // Stops the Escape from also closing the event panel behind the list.
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="relative min-w-0 flex-1 md:max-w-sm">
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={t("search.label")}
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        placeholder={t("search.placeholder")}
        value={query}
        data-testid="search"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        // Delayed so a click on a result lands before the list closes.
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        className="w-full rounded-full border border-line bg-bg px-4 py-1.5 text-sm"
      />
      {showList && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-line bg-surface shadow-xl md:min-w-80">
          {results.length === 0 && <li className="px-3 py-2 text-sm text-muted">{t("search.noResults")}</li>}
          {results.map((r, i) => (
            <li
              key={`${r.kind}-${r.item.id}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              data-testid="search-result"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(r)}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${i === active ? "bg-surface-2" : ""}`}
            >
              {r.kind === "event" ? (
                <>
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_META[r.item.category].color }} />
                  <span className="min-w-0 flex-1 truncate">{r.item.title}</span>
                  <span className="shrink-0 text-xs text-muted">{formatYearRange(r.item.start_year, r.item.end_year, era)}</span>
                </>
              ) : r.kind === "city" ? (
                <>
                  <span className="shrink-0 rounded bg-surface-2 px-1 text-xs">{t("search.city")}</span>
                  <span className="min-w-0 flex-1 truncate">{r.item.name}</span>
                </>
              ) : (
                <>
                  <span className="shrink-0 rounded bg-surface-2 px-1 text-xs">{t("search.person")}</span>
                  <span className="min-w-0 flex-1 truncate">{r.item.name}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {t("search.lived", {
                      start: r.item.birth_year === null ? t("search.unknown") : formatYear(r.item.birth_year, era),
                      end: r.item.death_year === null ? t("search.unknown") : formatYear(r.item.death_year, era),
                    })}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
