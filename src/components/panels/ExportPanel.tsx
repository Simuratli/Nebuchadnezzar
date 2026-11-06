"use client";

import type { Map as MlMap } from "maplibre-gl";
import { useTranslations } from "next-intl";
import { useEra } from "@/lib/use-era";
import { useEffect, useMemo, useState } from "react";
import { getManifest } from "@/lib/boundaries";
import type { CitationText } from "@/lib/citation/common";
import { mapCaption, mapCitation, type MapCaptionInput, type MapCaptionLanguage, type MapCaptionText } from "@/lib/map-citation";
import { canvasToBlob, canvasToPdf, composeMapImage, downloadBlob } from "@/lib/map-export";
import { CATEGORIES, type Category } from "@/lib/types";
import { boundaryForYear, type BoundaryEntry } from "@/lib/year";
import { useAtlas } from "@/store/atlas";

type Status = "idle" | "busy" | "error" | "copied";

export function ExportPanel({ maps }: { maps: (MlMap | null)[] }) {
  const t = useTranslations();
  const year = useAtlas((s) => s.year);
  const year2 = useAtlas((s) => s.year2);
  const compare = useAtlas((s) => s.compare);
  const [manifest, setManifest] = useState<BoundaryEntry[]>([]);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    getManifest().then(setManifest).catch(() => setManifest([]));
  }, []);

  const caption = useMemo<MapCaptionInput>(
    () => ({
      year,
      year2: compare ? year2 : undefined,
      boundaryYear: boundaryForYear(year, manifest)?.year ?? null,
      boundaryYear2: compare ? (boundaryForYear(year2, manifest)?.year ?? null) : undefined,
      url: window.location.href,
      accessed: new Date().toISOString().slice(0, 10),
    }),
    [year, year2, compare, manifest],
  );
  const era = useEra();
  const lang: MapCaptionLanguage = {
    caption: t.raw("mapCaption") as MapCaptionText,
    citation: t.raw("citationFormat") as CitationText,
    era,
    appTitle: t("app.title"),
  };
  const preview = mapCaption(caption, lang);
  const citation = mapCitation(caption, lang);

  const fileBase = `nebuchadnezzar-${year}${compare ? `-${year2}` : ""}`;

  const save = async (format: "png" | "pdf") => {
    const ready = maps.filter((m): m is MlMap => m !== null);
    if (ready.length === 0) return;
    setStatus("busy");
    try {
      const labels = Object.fromEntries(CATEGORIES.map((c) => [c, t(`categories.${c}`)])) as Record<Category, string>;
      // The URL is read at export time, because the address bar updates after a short delay.
      const canvas = await composeMapImage(ready, { ...caption, url: window.location.href }, lang, labels);
      const blob = format === "png" ? await canvasToBlob(canvas, "image/png") : await canvasToPdf(canvas);
      downloadBlob(`${fileBase}.${format}`, blob);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(mapCitation({ ...caption, url: window.location.href }, lang));
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="space-y-4 text-sm" data-testid="export-panel">
      <p className="text-muted">{t("export.help")}</p>
      <div className="flex gap-2">
        <button type="button" disabled={status === "busy"} onClick={() => save("png")} data-testid="export-png" className="rounded bg-accent px-3 py-1.5 font-medium text-accent-ink disabled:opacity-60">
          {t("export.png")}
        </button>
        <button type="button" disabled={status === "busy"} onClick={() => save("pdf")} data-testid="export-pdf" className="rounded bg-accent px-3 py-1.5 font-medium text-accent-ink disabled:opacity-60">
          {t("export.pdf")}
        </button>
      </div>
      {status === "busy" && <p role="status">{t("export.preparing")}</p>}
      {status === "error" && (
        <p role="alert" className="rounded bg-warn-bg px-2 py-1 text-xs text-warn-ink">
          {t("export.failed")}
        </p>
      )}

      <section>
        <h3 className="mb-1 font-medium">{t("export.caption")}</h3>
        <div data-testid="export-caption" className="rounded border border-line p-3 text-xs leading-relaxed">
          <p className="font-medium">{preview.title}</p>
          {preview.lines.map((line) => (
            <p key={line} className="mt-1 break-words">
              {line}
            </p>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-1 font-medium">{t("export.citation")}</h3>
        <p data-testid="export-citation" className="break-words rounded bg-surface-2 p-2 text-xs">
          {citation}
        </p>
        <button type="button" onClick={copy} data-testid="export-copy" className="mt-2 rounded border border-line px-3 py-1.5 hover:bg-surface-2">
          {status === "copied" ? t("source.copied") : t("export.copy")}
        </button>
      </section>

      <p className="rounded bg-warn-bg px-2 py-1 text-xs text-warn-ink">{t("export.accuracy")}</p>
    </div>
  );
}
