"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useEra } from "@/lib/use-era";
import { POLITY_GROUPS, type Polity } from "@/lib/types";
import { axisPosition, barSpan, existsInYear, statesByGroup } from "@/lib/polities";
import { formatYear, MAX_YEAR, MIN_YEAR } from "@/lib/year";
import { useAtlas } from "@/store/atlas";

const TICKS = [-500, 1, 500, 1000, 1500, 1950];

/**
 * States as bars on the app's year axis. One colour on purpose: every row is labelled, so
 * colour only marks which states exist in the selected year, and hollow bars mark hand-entered dates.
 */
export function StatesChart({ polities }: { polities: Polity[] }) {
  const t = useTranslations("states");
  const era = useEra();
  const year = useAtlas((s) => s.year);
  const setYear = useAtlas((s) => s.setYear);
  const setSidePanel = useAtlas((s) => s.setSidePanel);
  const [focused, setFocused] = useState<Polity | null>(null);
  const groups = useMemo(() => statesByGroup(polities), [polities]);
  const active = polities.filter((p) => existsInYear(p, year)).length;
  const span = (p: Polity) => `${formatYear(p.from, era)} – ${p.to === null ? t("present") : formatYear(p.to, era)}`;
  const cursor = axisPosition(year);

  return (
    <section
      aria-label={t("title")}
      data-testid="states-chart"
      className="floating-card absolute inset-x-2 bottom-[calc(var(--timeline-h,90px)+16px)] z-30 flex h-[60%] flex-col overflow-hidden md:inset-x-3 md:h-[64%]"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
        <h2 className="font-serif text-lg font-semibold">{t("title")}</h2>
        <p data-testid="states-count" className="text-sm text-muted" aria-live="polite">
          {t("activeCount", { count: active, year: formatYear(year, era) })}
        </p>
        <ul className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-5 rounded bg-accent" />
            {t("legendActive")}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-5 rounded bg-muted opacity-50" />
            {t("legendOther")}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-5 rounded border-[1.5px] border-muted" />
            {t("legendManual")}
          </li>
        </ul>
        <button
          type="button"
          onClick={() => setSidePanel(null)}
          aria-label={t("close")}
          data-testid="states-close"
          className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <p data-testid="states-detail" className="min-h-6 px-4 pb-1 text-sm">
        {focused ? (
          <>
            <span className="font-medium">{focused.name}</span> · {span(focused)}
            {focused.manual_dates && <span className="ml-1 rounded bg-warn-bg px-1 text-xs text-warn-ink">{t("manualDates")}</span>}
            {" · "}
            <a href={focused.url} target="_blank" rel="noreferrer" className="text-accent underline">
              {t("source")}
            </a>
          </>
        ) : (
          <span className="text-muted">{t("hint")}</span>
        )}
      </p>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[760px] pb-3">
          <div className="sticky top-0 z-20 flex border-b border-line bg-surface text-[11px] text-muted">
            <div className="sticky left-0 z-10 w-44 shrink-0 bg-surface md:w-56" />
            <div className="relative mr-6 h-5 flex-1">
              {TICKS.map((tick) => (
                <span key={tick} className="absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0 last:-translate-x-full" style={{ left: `${axisPosition(tick)}%` }}>
                  {formatYear(tick, era)}
                </span>
              ))}
            </div>
          </div>

          {POLITY_GROUPS.map((group) => (
            <div key={group} role="group" aria-label={t(`groups.${group}`)}>
              <h3 className="sticky left-0 w-44 bg-surface px-4 pb-0.5 pt-2 text-xs font-semibold uppercase tracking-wide text-muted md:w-56">{t(`groups.${group}`)}</h3>
              <ul>
                {groups[group].map((p) => {
                  const on = existsInYear(p, year);
                  const { left, width, openLeft, openRight } = barSpan(p);
                  return (
                    <li key={p.id}>
                      {/* The whole row is the target, far larger than the thin bar. */}
                      <button
                        type="button"
                        data-testid="state-row"
                        data-state={p.id}
                        data-active={on}
                        aria-label={`${p.name}, ${span(p)}`}
                        aria-pressed={focused?.id === p.id}
                        onClick={() => {
                          setFocused(p);
                          if (!on) setYear(Math.max(p.from, MIN_YEAR));
                        }}
                        onMouseEnter={() => setFocused(p)}
                        onFocus={() => setFocused(p)}
                        className={`flex w-full items-center text-left hover:bg-surface-2 ${focused?.id === p.id ? "bg-surface-2" : ""}`}
                      >
                        <span className={`sticky left-0 z-10 w-44 shrink-0 truncate bg-inherit px-4 py-0.5 text-xs md:w-56 ${on ? "font-semibold text-ink" : "text-muted"}`} title={p.name}>
                          {p.name}
                        </span>
                        <span className="relative mr-6 block h-5 flex-1">
                          {TICKS.map((tick) => (
                            <span key={tick} aria-hidden="true" className="absolute inset-y-0 w-px bg-line opacity-50" style={{ left: `${axisPosition(tick)}%` }} />
                          ))}
                          <span
                            aria-hidden="true"
                            data-testid="state-bar"
                            className={`absolute top-1/2 h-2.5 min-w-1 -translate-y-1/2 ${openLeft ? "rounded-l-none" : "rounded-l"} ${openRight ? "rounded-r-none" : "rounded-r"} ${
                              p.manual_dates ? `border-[1.5px] ${on ? "border-accent" : "border-muted opacity-60"}` : on ? "bg-accent" : "bg-muted opacity-40"
                            }`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                          />
                          <span aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${cursor}%` }} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <p className="px-4 pt-3 text-xs text-muted">{t("note", { from: formatYear(MIN_YEAR, era), to: formatYear(MAX_YEAR, era) })}</p>
        </div>
      </div>
    </section>
  );
}
