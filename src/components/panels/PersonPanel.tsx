"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEra } from "@/lib/use-era";
import { useCallback, useMemo } from "react";
import type { EventSummary, HistoricalRoute, Person } from "@/lib/types";
import { clampYear, formatYear } from "@/lib/year";
import { useAtlas } from "@/store/atlas";
import { DetailShell } from "./DetailShell";
import { EventList } from "./EventList";
import { SourceList } from "./SourceList";

const commonsPage = (imageUrl: string) => {
  const file = /Special:FilePath\/([^?]+)/.exec(imageUrl)?.[1];
  return file ? `https://commons.wikimedia.org/wiki/File:${file}` : imageUrl;
};

type Props = { people: Person[]; events: EventSummary[]; routes: HistoricalRoute[] };

export function PersonPanel({ people, events, routes }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const era = useEra();
  const personId = useAtlas((s) => s.personId);
  const selectPerson = useAtlas((s) => s.selectPerson);
  const person = people.find((p) => p.id === personId);
  const close = useCallback(() => selectPerson(null), [selectPerson]);

  const linked = useMemo(() => {
    if (!person) return [];
    const byId = new Map(events.map((e) => [e.id, e]));
    return person.events.flatMap((l) => byId.get(l.event_id) ?? []).sort((a, b) => a.start_year - b.start_year);
  }, [person, events]);

  if (!person) return null;
  const manual = new Set(person.events.filter((l) => l.manual).map((l) => l.event_id));
  const personRoutes = routes.filter((r) => r.person_id === person.id);
  const unknown = t("person.unknown");
  const lived = `${person.birth_year === null ? unknown : formatYear(person.birth_year, era)} – ${person.death_year === null ? unknown : formatYear(person.death_year, era)}`;
  // clampYear also steps over the missing year 0 for lives spanning the era boundary.
  const midYear = person.birth_year !== null && person.death_year !== null ? clampYear((person.birth_year + person.death_year) / 2) : (person.birth_year ?? person.death_year);
  const langName = (code: string) => new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;

  const showPlace = (place: NonNullable<Person["birth_place"]>) => useAtlas.getState().flyTo({ lng: place.lng, lat: place.lat, zoom: 6 });

  return (
    <DetailShell kind="person" label={t("person.panel")} recordId={person.id} onClose={close}>
      <article>
        <p className="mb-1 text-sm text-muted">{t("person.kind")}</p>
        <h2 data-testid="person-title" className="font-serif text-2xl font-semibold leading-tight">
          {person.name}
        </h2>
        <p data-testid="person-lived" className="mt-1 text-sm font-medium text-muted">
          {lived}
        </p>

        {person.needs_review && (
          <p data-testid="person-review" className="mt-3 rounded bg-warn-bg px-3 py-2 text-sm text-warn-ink">
            {t("person.needsReview")}
          </p>
        )}
        {person.content_lang !== locale && (
          <p data-testid="language-note" className="mt-3 rounded bg-surface-2 px-3 py-2 text-sm">
            {t("event.languageNote", { lang: langName(person.content_lang) })}
          </p>
        )}

        {person.image_url && (
          <figure className="mt-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote Commons redirect; the image optimizer adds nothing here */}
            <img src={person.image_url} alt={person.name} loading="lazy" className="max-h-64 rounded object-contain" />
            <figcaption className="mt-1 text-xs text-muted">
              <a href={commonsPage(person.image_url)} target="_blank" rel="noreferrer" className="underline">
                {t("event.imageCredit")}
              </a>
            </figcaption>
          </figure>
        )}

        {person.description ? (
          <>
            <p className="mt-4 leading-relaxed">{person.description}</p>
            <p className="mt-2 text-xs text-muted">{t("event.wikiLicense")}</p>
          </>
        ) : (
          <p className="mt-4 text-muted">{t("person.noSummary")}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {midYear !== null && (
            <button
              type="button"
              onClick={() => useAtlas.getState().setYear(midYear)}
              data-testid="person-go-year"
              className="rounded bg-accent px-3 py-1.5 font-medium text-accent-ink"
            >
              {t("person.goToEra", { year: formatYear(midYear, era) })}
            </button>
          )}
          {personRoutes.map((route) => (
            <button
              key={route.id}
              type="button"
              onClick={() => {
                const atlas = useAtlas.getState();
                atlas.setSidePanel("routes");
                atlas.setRoute(route.id);
              }}
              data-testid="person-route"
              className="rounded border border-line px-3 py-1.5 hover:bg-surface-2"
            >
              {t("person.showRoute", { title: route.title })}
            </button>
          ))}
        </div>

        {(person.birth_place || person.death_place) && (
          <dl className="mt-4 space-y-1 text-sm">
            {person.birth_place && (
              <div className="flex gap-2">
                <dt className="text-muted">{t("person.born")}:</dt>
                <dd>
                  <button type="button" onClick={() => showPlace(person.birth_place as NonNullable<Person["birth_place"]>)} data-testid="person-birth-place" className="text-accent underline">
                    {person.birth_place.name}
                  </button>
                </dd>
              </div>
            )}
            {person.death_place && (
              <div className="flex gap-2">
                <dt className="text-muted">{t("person.died")}:</dt>
                <dd>
                  <button type="button" onClick={() => showPlace(person.death_place as NonNullable<Person["death_place"]>)} className="text-accent underline">
                    {person.death_place.name}
                  </button>
                </dd>
              </div>
            )}
          </dl>
        )}

        <section className="mt-5">
          <h3 className="mb-1 font-serif text-lg font-semibold">{t("person.events")}</h3>
          {linked.length === 0 ? (
            <p className="text-sm text-muted" data-testid="person-no-events">
              {t("person.noEvents")}
            </p>
          ) : (
            <EventList events={linked} testId="person-event" tag={(e) => (manual.has(e.id) ? t("person.manualLink") : null)} />
          )}
        </section>

        <SourceList sources={person.sources} />
      </article>
    </DetailShell>
  );
}
