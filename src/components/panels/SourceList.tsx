"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { formatApa } from "@/lib/citation/apa";
import { formatBibtex } from "@/lib/citation/bibtex";
import { formatChicago } from "@/lib/citation/chicago";
import { missingFields } from "@/lib/citation/common";
import type { Source } from "@/lib/types";

const FORMATS = [
  { label: "APA 7", format: formatApa },
  { label: "Chicago", format: formatChicago },
  { label: "BibTeX", format: formatBibtex },
] as const;

const BADGE: Record<Source["type"], string> = {
  birincil: "bg-[#2f6b4f] text-white",
  ikincil: "bg-[#2f5f8f] text-white",
  ansiklopedi: "bg-surface-2 text-ink border border-line",
};

function CopyButton({ label, getText }: { label: string; getText: () => string }) {
  const t = useTranslations("source");
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus("idle"), 1800);
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={t("copy", { format: label })}
      data-testid={`copy-${label}`}
      className="rounded border border-line px-2 py-1 text-xs hover:bg-surface-2"
    >
      <span aria-live="polite">{status === "copied" ? t("copied") : status === "failed" ? t("copyFailed") : label}</span>
    </button>
  );
}

export function SourceList({ sources }: { sources: Source[] }) {
  const t = useTranslations();
  return (
    <section className="mt-6" data-testid="sources">
      <h3 className="mb-2 font-serif text-lg font-semibold">{t("event.sources")}</h3>
      {sources.length === 0 && <p className="text-sm text-muted">{t("event.noSources")}</p>}
      <ul className="space-y-3">
        {sources.map((source) => {
          const missing = missingFields(source);
          return (
            <li key={source.id} className="rounded border border-line p-3 text-sm" data-testid="source-item">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${BADGE[source.type]}`}>{t(`source.${source.type}`)}</span>
                <span className="text-xs text-muted">{t("source.reliability", { value: source.reliability })}</span>
              </div>
              <p className="font-medium">{source.title ?? t("source.untitled")}</p>
              <p className="text-xs text-muted">{[source.author, source.publisher, source.year].filter(Boolean).join(" · ")}</p>
              {source.url && (
                <a href={source.url} target="_blank" rel="noreferrer" className="text-xs text-accent underline">
                  {t("source.open")}
                </a>
              )}
              {missing.length > 0 && (
                <p className="mt-2 rounded bg-warn-bg px-2 py-1 text-xs text-warn-ink">
                  {t("source.missing", { fields: missing.map((f) => t(`source.fields.${f}`)).join(", ") })}
                </p>
              )}
              {source.needs_review && <p className="mt-2 rounded bg-warn-bg px-2 py-1 text-xs text-warn-ink">{t("source.reviewFlag")}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {FORMATS.map(({ label, format }) => (
                  <CopyButton key={label} label={label} getText={() => format(source)} />
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
