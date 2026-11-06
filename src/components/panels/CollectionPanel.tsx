"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEra } from "@/lib/use-era";
import { useMemo, useState } from "react";
import { formatBibtexCollection } from "@/lib/citation/bibtex";
import { downloadText } from "@/lib/export";
import type { EventSummary, Source } from "@/lib/types";
import { formatYearRange } from "@/lib/year";
import { useAtlas } from "@/store/atlas";
import { useCollection } from "@/store/collection";

export function CollectionPanel({ events }: { events: EventSummary[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const era = useEra();
  const items = useCollection((s) => s.items);
  const remove = useCollection((s) => s.remove);
  const setNote = useCollection((s) => s.setNote);
  const openEvent = useAtlas((s) => s.openEvent);
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");

  const download = async () => {
    setStatus("busy");
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: items.map((i) => i.eventId), locale }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const sources = (await res.json()) as Source[];
      downloadText("nebuchadnezzar-koleksiyon.bib", formatBibtexCollection(sources), "application/x-bibtex;charset=utf-8");
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="space-y-4 text-sm" data-testid="collection-panel">
      <p className="text-xs text-muted">{t("collection.localNotice")}</p>
      {items.length === 0 ? (
        <p className="text-muted">{t("collection.empty")}</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span data-testid="collection-count" className="font-medium">
              {t("collection.count", { count: items.length })}
            </span>
            <button
              type="button"
              onClick={download}
              disabled={status === "busy"}
              data-testid="download-bibtex"
              className="ml-auto rounded bg-accent px-3 py-1.5 font-medium text-accent-ink disabled:opacity-60"
            >
              {status === "busy" ? t("collection.preparing") : t("collection.downloadBibtex")}
            </button>
          </div>
          {status === "error" && (
            <p role="alert" className="rounded bg-warn-bg px-2 py-1 text-xs text-warn-ink">
              {t("collection.downloadFailed")}
            </p>
          )}
          <ul className="space-y-3">
            {items.map((item) => {
              const event = byId.get(item.eventId);
              return (
                <li key={item.eventId} className="rounded border border-line p-3" data-testid="collection-item">
                  {event ? (
                    <button type="button" onClick={() => openEvent(event)} className="text-left font-medium underline-offset-2 hover:underline">
                      {event.title}
                    </button>
                  ) : (
                    <span className="font-medium">{item.eventId}</span>
                  )}
                  {event && <p className="text-xs text-muted">{formatYearRange(event.start_year, event.end_year, era)}</p>}
                  <label className="mt-2 block">
                    <span className="sr-only">{t("collection.note")}</span>
                    <textarea
                      value={item.note}
                      onChange={(e) => setNote(item.eventId, e.target.value)}
                      placeholder={t("collection.notePlaceholder")}
                      rows={2}
                      className="w-full rounded border border-line bg-bg p-2"
                    />
                  </label>
                  <button type="button" onClick={() => remove(item.eventId)} className="mt-1 text-xs text-accent underline">
                    {t("collection.remove")}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
