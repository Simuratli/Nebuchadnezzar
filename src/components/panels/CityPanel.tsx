"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEra } from "@/lib/use-era";
import { useCallback, useMemo } from "react";
import { eventsNearCity, nameAtYear, NEARBY_KM } from "@/lib/cities";
import type { City, EventSummary } from "@/lib/types";
import { formatYear } from "@/lib/year";
import { useAtlas } from "@/store/atlas";
import { DetailShell } from "./DetailShell";
import { EventList } from "./EventList";
import { SourceList } from "./SourceList";

export function CityPanel({ cities, events }: { cities: City[]; events: EventSummary[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const era = useEra();
  const cityId = useAtlas((s) => s.cityId);
  const year = useAtlas((s) => s.year);
  const selectCity = useAtlas((s) => s.selectCity);
  const setYear = useAtlas((s) => s.setYear);
  const city = cities.find((c) => c.id === cityId);
  const near = useMemo(() => (city ? eventsNearCity(events, city) : []), [city, events]);
  const close = useCallback(() => selectCity(null), [selectCity]);
  if (!city) return null;

  const bound = (y: number | null, fallback: string) => (y === null ? fallback : formatYear(y, era));
  const nameNow = nameAtYear(city, year);

  return (
    <DetailShell kind="city" label={t("city.panel")} recordId={city.id} onClose={close}>
      <article>
        <p className="mb-1 text-sm text-muted">{t("city.kind")}</p>
        <h2 data-testid="city-title" className="font-serif text-2xl font-semibold leading-tight">
          {city.name}
        </h2>
        <p data-testid="city-name-now" className="mt-1 text-sm text-muted">
          {t("city.nameInYear", { year: formatYear(year, era), name: nameNow })}
        </p>
        {city.content_lang !== locale && (
          <p data-testid="language-note" className="mt-3 rounded bg-surface-2 px-3 py-2 text-sm">
            {t("event.languageNote", { lang: new Intl.DisplayNames([locale], { type: "language" }).of(city.content_lang) ?? city.content_lang })}
          </p>
        )}
        {city.summary && <p className="mt-3 leading-relaxed">{city.summary}</p>}

        <section className="mt-5">
          <h3 className="mb-1 font-serif text-lg font-semibold">{t("city.names")}</h3>
          {city.periods.length === 0 && city.other_names.length === 0 && <p className="text-sm text-muted">{t("city.noNames")}</p>}
          {city.periods.length > 0 && (
            <ol className="divide-y divide-line text-sm" data-testid="city-periods">
              {city.periods.map((p) => (
                <li key={`${p.name}-${p.from}`} className="flex items-baseline justify-between gap-2 py-1.5">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-right text-xs text-muted">
                    {bound(p.from, t("city.unknownStart"))} – {bound(p.to, t("city.present"))}
                    {!p.confirmed && <span className="ml-1 rounded bg-warn-bg px-1 text-warn-ink">{t("city.unconfirmed")}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {city.other_names.length > 0 && (
            <p className="mt-2 text-sm" data-testid="city-other-names">
              <span className="text-muted">{t("city.otherNames")}: </span>
              {city.other_names.join(", ")}
              <span className="ml-1 rounded bg-warn-bg px-1 text-xs text-warn-ink">{t("city.unconfirmed")}</span>
            </p>
          )}
        </section>

        <section className="mt-5">
          <h3 className="mb-1 font-serif text-lg font-semibold">{t("city.rulers")}</h3>
          <p data-testid="city-rulers-warning" className="mb-2 rounded bg-warn-bg px-3 py-2 text-xs text-warn-ink">
            {t("city.rulersWarning")}
          </p>
          <ol className="divide-y divide-line text-sm" data-testid="city-rulers">
            {city.rulers.map((r) => (
              <li key={r.from}>
                <button type="button" onClick={() => setYear(r.from)} className="flex w-full items-baseline justify-between gap-2 py-1.5 text-left hover:bg-surface-2">
                  <span>
                    {r.name ?? <span className="text-muted">{t("city.unknownRuler")}</span>}
                    {r.manual && <span className="ml-1 rounded bg-warn-bg px-1 text-xs text-warn-ink">{t("city.manualRuler")}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {formatYear(r.from, era)} – {formatYear(r.to, era)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-5">
          <h3 className="mb-1 font-serif text-lg font-semibold">{t("city.events", { km: NEARBY_KM })}</h3>
          {near.length === 0 ? <p className="text-sm text-muted">{t("city.noEvents")}</p> : <EventList events={near} testId="city-event" />}
        </section>

        <SourceList sources={city.sources} />
      </article>
    </DetailShell>
  );
}
