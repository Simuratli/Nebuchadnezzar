"use client";

import { useTranslations } from "next-intl";
import { useCollection } from "@/store/collection";

export function CollectionControls({ eventId }: { eventId: string }) {
  const t = useTranslations("collection");
  const item = useCollection((s) => s.items.find((i) => i.eventId === eventId));
  const add = useCollection((s) => s.add);
  const remove = useCollection((s) => s.remove);
  const setNote = useCollection((s) => s.setNote);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => (item ? remove(eventId) : add(eventId))}
        aria-pressed={Boolean(item)}
        data-testid="collection-toggle"
        className={`rounded px-3 py-1.5 text-sm font-medium ${item ? "border border-line hover:bg-surface-2" : "bg-accent text-accent-ink"}`}
      >
        {item ? t("remove") : t("add")}
      </button>
      {item && (
        <label className="mt-2 block text-sm">
          <span className="text-muted">{t("note")}</span>
          <textarea
            value={item.note}
            onChange={(e) => setNote(eventId, e.target.value)}
            placeholder={t("notePlaceholder")}
            rows={3}
            data-testid="collection-note"
            className="mt-1 w-full rounded border border-line bg-bg p-2"
          />
        </label>
      )}
    </div>
  );
}
