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
      className="absolute inset-x-0 bottom-0 z-30 flex max-h-[70%] flex-col rounded-t-2xl border-t border-line bg-surface shadow-2xl outline-none md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:rounded-none md:border-l md:border-t-0"
    >
      <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line md:hidden" />
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
