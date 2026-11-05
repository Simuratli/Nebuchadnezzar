"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { useAtlas } from "@/store/atlas";

/** Left drawer on desktop, bottom sheet on mobile. */
export function SidePanel({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTranslations("app");
  const setSidePanel = useAtlas((s) => s.setSidePanel);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [title]);

  return (
    <aside
      ref={ref}
      tabIndex={-1}
      aria-label={title}
      data-testid="side-panel"
      className="absolute inset-x-0 bottom-0 z-30 flex max-h-[75%] flex-col rounded-t-2xl border-t border-line bg-surface shadow-2xl outline-none md:inset-y-0 md:left-0 md:right-auto md:max-h-none md:w-[340px] md:rounded-none md:border-r md:border-t-0"
    >
      <div className="flex items-center justify-between px-4 py-2">
        <h2 className="font-serif text-lg font-semibold">{title}</h2>
        <button
          type="button"
          onClick={() => setSidePanel(null)}
          aria-label={t("close")}
          data-testid="side-close"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">{children}</div>
    </aside>
  );
}
