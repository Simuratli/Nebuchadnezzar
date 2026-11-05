"use client";

import { useTranslations } from "next-intl";
import { useAtlas, type SidePanel } from "@/store/atlas";

const PANELS: Exclude<SidePanel, null>[] = ["filters", "collection", "routes", "tours"];

export function NavButtons() {
  const t = useTranslations("nav");
  const sidePanel = useAtlas((s) => s.sidePanel);
  const setSidePanel = useAtlas((s) => s.setSidePanel);
  const compare = useAtlas((s) => s.compare);
  const setCompare = useAtlas((s) => s.setCompare);
  return (
    <nav aria-label={t("panels")} className="flex items-center gap-1 overflow-x-auto">
      {PANELS.map((panel) => (
        <button
          key={panel}
          type="button"
          aria-pressed={sidePanel === panel}
          data-testid={`nav-${panel}`}
          onClick={() => setSidePanel(sidePanel === panel ? null : panel)}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${sidePanel === panel ? "bg-accent text-accent-ink" : "hover:bg-surface-2"}`}
        >
          {t(panel)}
        </button>
      ))}
      <button
        type="button"
        aria-pressed={compare}
        data-testid="nav-compare"
        onClick={() => setCompare(!compare)}
        className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${compare ? "bg-accent text-accent-ink" : "hover:bg-surface-2"}`}
      >
        {t("compare")}
      </button>
    </nav>
  );
}
