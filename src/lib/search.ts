import Fuse from "fuse.js";
import type { EventSummary, Person } from "./types";

/**
 * Folds text for matching: Turkish-aware lowercase ("İ" → "i", "I" → "ı"), then
 * accents and dotless ı removed, so "istanbul" finds "İstanbul" and "sivas" finds "Sıvas".
 */
export function foldText(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i");
}

export type SearchResult = { kind: "event"; item: EventSummary } | { kind: "person"; item: Person };

export function createSearch(events: EventSummary[], people: Person[]) {
  const docs: (SearchResult & { folded: string })[] = [
    ...people.map((item) => ({ kind: "person" as const, item, folded: foldText(item.name) })),
    ...events.map((item) => ({ kind: "event" as const, item, folded: foldText(item.title) })),
  ];
  const fuse = new Fuse(docs, { keys: ["folded"], threshold: 0.3, ignoreLocation: true, minMatchCharLength: 2 });
  return (query: string, limit = 12): SearchResult[] => {
    const q = foldText(query.trim());
    if (q.length < 2) return [];
    return fuse.search(q, { limit }).map(({ item }) => {
      const { folded: _folded, ...result } = item;
      return result as SearchResult;
    });
  };
}
