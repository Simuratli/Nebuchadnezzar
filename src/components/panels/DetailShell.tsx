"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

type Props = {
  /** Prefix for the panel and close button test ids. */
  kind: string;
  label: string;
  /** Moves focus into the panel whenever the shown record changes. */
  recordId: string;
  onClose: () => void;
  children: React.ReactNode;
};

/** Right panel on desktop, bottom sheet on mobile, shared by event, person and city details. */
export function DetailShell({ kind, label, recordId, onClose, children }: Props) {
  const t = useTranslations("app");
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [recordId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside
      ref={ref}
      tabIndex={-1}
      aria-label={label}
      data-testid={`${kind}-panel`}
      className="floating-card absolute inset-x-2 bottom-[calc(var(--timeline-h,90px)+16px)] z-30 flex max-h-[58%] flex-col overflow-hidden outline-none md:inset-x-auto md:right-3 md:top-[calc(var(--header-h,60px)+20px)] md:bottom-[calc(var(--timeline-h,90px)+20px)] md:max-h-none md:w-[400px]"
    >
            <div className="flex justify-end px-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          data-testid={`${kind}-close`}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">{children}</div>
    </aside>
  );
}
