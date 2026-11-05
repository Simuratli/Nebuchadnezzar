"use client";

import { useTranslations } from "next-intl";
import { useAtlas, type SidePanel } from "@/store/atlas";

const PANELS: Exclude<SidePanel, null>[] = ["filters", "collection", "routes", "tours", "states", "export"];

export function NavButtons() {
  const t = useTranslations("nav");
  const sidePanel = useAtlas((s) => s.sidePanel);
  const setSidePanel = useAtlas((s) => s.setSidePanel);
  const compare = useAtlas((s) => s.compare);
  const setCompare = useAtlas((s) => s.setCompare);
  return (
    <nav aria-label={t("panels")} className="flex items-center gap-0.5 overflow-x-auto">
      {PANELS.map((panel) => (
        <button
          key={panel}
          type="button"
          aria-pressed={sidePanel === panel}
          data-testid={`nav-${panel}`}
          onClick={() => setSidePanel(sidePanel === panel ? null : panel)}
          className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium ${sidePanel === panel ? "bg-accent text-accent-ink" : "text-ink hover:bg-surface-2"}`}
        >
          {t(panel)}
        </button>
      ))}
      <button
        type="button"
        aria-pressed={compare}
        data-testid="nav-compare"
        onClick={() => setCompare(!compare)}
        className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium ${compare ? "bg-accent text-accent-ink" : "text-ink hover:bg-surface-2"}`}
      >
        {t("compare")}
      </button>
    </nav>
  );
}
