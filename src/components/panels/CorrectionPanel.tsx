"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { sliceAt } from "@/lib/corrections";
import type { Correction } from "@/lib/types";
import { formatYear } from "@/lib/year";
import { useAtlas } from "@/store/atlas";
import { DetailShell } from "./DetailShell";
import { SourceList } from "./SourceList";

export function CorrectionPanel({ corrections }: { corrections: Correction[] }) {
  const t = useTranslations();
  const era = { bc: t("era.bc"), ad: t("era.ad") };
  const correctionId = useAtlas((s) => s.correctionId);
  const year = useAtlas((s) => s.year);
  const setYear = useAtlas((s) => s.setYear);
  const selectCorrection = useAtlas((s) => s.selectCorrection);
  const correction = corrections.find((c) => c.id === correctionId);
  const close = useCallback(() => selectCorrection(null), [selectCorrection]);
  if (!correction) return null;

  const current = sliceAt(correction, year);

  return (
    <DetailShell kind="correction" label={t("correction.panel")} recordId={correction.id} onClose={close}>
      <article>
        <p className="mb-1 text-sm text-muted">{t("correction.kind")}</p>
        <h2 data-testid="correction-title" className="font-serif text-2xl font-semibold leading-tight">
          {current?.name ?? t("correction.outside")}
        </h2>
        {current && (
          <p className="mt-1 text-sm font-medium text-muted">
            {formatYear(current.from, era)} – {formatYear(current.to, era)}
          </p>
        )}
        <p data-testid="correction-warning" className="mt-3 rounded bg-warn-bg px-3 py-2 text-sm text-warn-ink">
          {t("correction.warning")}
        </p>
        {current?.note && <p className="mt-3 leading-relaxed">{current.note}</p>}

        <section className="mt-5">
          <h3 className="mb-1 font-serif text-lg font-semibold">{t("correction.periods")}</h3>
          <ol className="divide-y divide-line text-sm" data-testid="correction-periods">
            {correction.slices.map((s) => (
              <li key={s.from}>
                <button
                  type="button"
                  onClick={() => setYear(s.from)}
                  aria-current={s === current ? "true" : undefined}
                  className={`flex w-full items-baseline justify-between gap-2 py-1.5 text-left hover:bg-surface-2 ${s === current ? "font-semibold" : ""}`}
                >
                  <span>{s.name}</span>
                  <span className="shrink-0 text-xs font-normal text-muted">
                    {formatYear(s.from, era)} – {formatYear(s.to, era)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        {current && <SourceList sources={current.sources} />}
      </article>
    </DetailShell>
  );
}
