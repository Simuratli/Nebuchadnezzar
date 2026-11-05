"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { CATEGORY_META } from "@/lib/categories";
import type { EventDetail } from "@/lib/types";
import { formatYearRange } from "@/lib/year";
import { useAtlas } from "@/store/atlas";
import { CollectionControls } from "./CollectionControls";
import { SourceList } from "./SourceList";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; event: EventDetail };

const commonsPage = (imageUrl: string) => {
  const file = /Special:FilePath\/([^?]+)/.exec(imageUrl)?.[1];
  return file ? `https://commons.wikimedia.org/wiki/File:${file}` : imageUrl;
};

export function EventPanel() {
  const t = useTranslations();
  const locale = useLocale();
  const eventId = useAtlas((s) => s.eventId);
  const selectEvent = useAtlas((s) => s.selectEvent);
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const panelRef = useRef<HTMLElement>(null);

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

  // Keyboard users land in the panel when it opens.
  useEffect(() => {
    if (eventId) panelRef.current?.focus();
  }, [eventId]);

  const close = useCallback(() => selectEvent(null), [selectEvent]);
  useEffect(() => {
    if (!eventId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [eventId, close]);

  if (!eventId) return null;
  const era = { bc: t("era.bc"), ad: t("era.ad") };
  const langName = (code: string) => new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      aria-label={t("event.panel")}
      data-testid="event-panel"
      className="absolute inset-x-0 bottom-0 z-30 flex max-h-[70%] flex-col rounded-t-2xl border-t border-line bg-surface shadow-2xl outline-none md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:rounded-none md:border-l md:border-t-0"
    >
      <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line md:hidden" />
      <div className="flex justify-end px-2 pt-1">
        <button
          type="button"
          onClick={close}
          aria-label={t("app.close")}
          data-testid="event-close"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6" aria-live="polite">
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

            <CollectionControls eventId={state.event.id} />
            <SourceList sources={state.event.sources} />

          </article>
        )}
      </div>
    </aside>
  );
}
