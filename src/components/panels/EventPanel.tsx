"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { CATEGORY_META } from "@/lib/categories";
import type { EventDetail, Person } from "@/lib/types";
import { formatYearRange } from "@/lib/year";
import { useAtlas } from "@/store/atlas";
import { CollectionControls } from "./CollectionControls";
import { DetailShell } from "./DetailShell";
import { SourceList } from "./SourceList";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; event: EventDetail };

const commonsPage = (imageUrl: string) => {
  const file = /Special:FilePath\/([^?]+)/.exec(imageUrl)?.[1];
  return file ? `https://commons.wikimedia.org/wiki/File:${file}` : imageUrl;
};

export function EventPanel({ people }: { people: Person[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const eventId = useAtlas((s) => s.eventId);
  const selectEvent = useAtlas((s) => s.selectEvent);
  const selectPerson = useAtlas((s) => s.selectPerson);
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!eventId) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    fetch(`/api/events/${encodeURIComponent(eventId)}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<EventDetail>;
      })
      .then((event) => setState({ status: "ready", event }))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setState({ status: "error" });
      });
    return () => controller.abort();
  }, [eventId, attempt]);

  const close = useCallback(() => selectEvent(null), [selectEvent]);

  if (!eventId) return null;
  const era = { bc: t("era.bc"), ad: t("era.ad") };
  const langName = (code: string) => new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;

  return (
    <DetailShell kind="event" label={t("event.panel")} recordId={eventId} onClose={close}>
      <div aria-live="polite">
        {state.status === "loading" && <p className="py-8 text-center text-muted">{t("event.loading")}</p>}
        {state.status === "error" && (
          <div className="py-8 text-center">
            <p className="mb-3 text-muted">{t("event.error")}</p>
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="rounded border border-line px-3 py-1.5 hover:bg-surface-2">
              {t("event.retry")}
            </button>
          </div>
        )}
        {state.status === "ready" && (
          <article>
            <p className="mb-1 flex items-center gap-2 text-sm text-muted">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_META[state.event.category].color }} />
              {t(`categories.${state.event.category}`)}
            </p>
            <h2 data-testid="event-title" className="font-serif text-2xl font-semibold leading-tight">
              {state.event.title}
            </h2>
            <p className="mt-1 text-sm font-medium text-muted">{formatYearRange(state.event.start_year, state.event.end_year, era)}</p>
            <p className="mt-1 text-xs text-muted">{state.event.region_tags.map((r) => t(`regions.${r}`)).join(" · ")}</p>

            {state.event.needs_review && (
              <p data-testid="needs-review" className="mt-3 rounded bg-warn-bg px-3 py-2 text-sm text-warn-ink">
                {t("event.needsReview")}
                {state.event.content_lang !== "tr" && <> {t("event.languageNote", { lang: langName(state.event.content_lang) })}</>}
              </p>
            )}

            {state.event.image_url && (
              <figure className="mt-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- remote Commons redirect; the image optimizer adds nothing here */}
                <img src={state.event.image_url} alt={state.event.title} loading="lazy" className="max-h-56 w-full rounded object-cover" />
                <figcaption className="mt-1 text-xs text-muted">
                  <a href={commonsPage(state.event.image_url)} target="_blank" rel="noreferrer" className="underline">
                    {t("event.imageCredit")}
                  </a>
                </figcaption>
              </figure>
            )}

            <div className="mt-4 leading-relaxed">
              {state.event.description ? (
                <ReactMarkdown>{state.event.description}</ReactMarkdown>
              ) : state.event.summary ? (
                <p>{state.event.summary}</p>
              ) : (
                <p className="text-muted">{t("event.noSummary")}</p>
              )}
            </div>
            {state.event.description && <p className="mt-2 text-xs text-muted">{t("event.wikiLicense")}</p>}

            {people.some((p) => p.events.some((l) => l.event_id === state.event.id)) && (
              <section className="mt-4 text-sm">
                <h3 className="mb-1 font-medium">{t("event.people")}</h3>
                <div className="flex flex-wrap gap-2">
                  {people
                    .filter((p) => p.events.some((l) => l.event_id === state.event.id))
                    .map((p) => (
                      <button key={p.id} type="button" onClick={() => selectPerson(p.id)} data-testid="event-person" className="rounded-full border border-line px-3 py-1 hover:bg-surface-2">
                        {p.name}
                      </button>
                    ))}
                </div>
              </section>
            )}

            <CollectionControls eventId={state.event.id} />
            <SourceList sources={state.event.sources} />

          </article>
        )}
      </div>
    </DetailShell>
  );
}
