import type { Source } from "@/lib/types";

/** A language's citation wording, kept in messages/<locale>.json under citationFormat. */
export type CitationText = {
  noDate: string;
  pages: string;
  retrieved: string;
  accessed: string;
  date: string;
  months: string[];
};

export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));

/** "2026-11-05" → "November 5, 2026". Returns null for anything that is not an ISO date. */
export function formatAccessDate(iso: string | null, text: CitationText): string | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (!m) return null;
  const month = text.months[Number(m[2]) - 1];
  return month ? fill(text.date, { day: Number(m[3]), month, year: m[1] }) : null;
}

export type CitableField = "author" | "title" | "year" | "publisher";

/**
 * Fields a reader would expect but the record lacks. Encyclopedia and wiki
 * entries legitimately have no author or fixed year, so those are not reported.
 */
export function missingFields(source: Source): CitableField[] {
  const required: CitableField[] = source.type === "ansiklopedi" ? ["title", "publisher"] : ["author", "title", "year", "publisher"];
  return required.filter((f) => source[f] === null || source[f] === "");
}

/** Ends a citation element with a period unless it already has closing punctuation ("Yazar, A."). */
export const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);
