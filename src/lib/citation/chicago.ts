import type { Source } from "@/lib/types";
import { fill, formatAccessDate, sentence, type CitationText } from "./common";

/** Chicago bibliography style. Missing fields are left out, never guessed. */
export function formatChicago(s: Source, text: CitationText): string {
  const author = s.author ? sentence(s.author) : null;
  const title = s.title ? (s.url ? `"${sentence(s.title)}"` : sentence(s.title)) : null;
  const imprint = [s.publisher, s.year].filter(Boolean).join(", ");
  const pages = s.pages ? `${s.pages}.` : null;
  const accessed = formatAccessDate(s.accessed_at, text);
  return [author, title, imprint ? `${imprint}.` : null, pages, accessed ? fill(text.accessed, { date: accessed }) : null, s.url ? `${s.url}.` : null]
    .filter(Boolean)
    .join(" ");
}
