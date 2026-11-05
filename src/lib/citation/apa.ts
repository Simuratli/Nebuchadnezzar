import type { Source } from "@/lib/types";
import { fill, formatAccessDate, sentence, type CitationText } from "./common";

/** APA 7 in the given language. Missing fields are left out, never guessed. */
export function formatApa(s: Source, text: CitationText): string {
  const date = `(${s.year ?? text.noDate}).`;
  const title = s.title ? sentence(s.title) : null;
  // Without an author, APA moves the title into the author position.
  const head = s.author ? [sentence(s.author), date, title] : [title, date];
  const pages = s.pages ? fill(text.pages, { pages: s.pages }) : null;
  const publisher = s.publisher ? sentence(s.publisher) : null;
  const accessed = formatAccessDate(s.accessed_at, text);
  const link = s.url ? (accessed ? fill(text.retrieved, { date: accessed, url: s.url }) : s.url) : null;
  return [...head, pages, publisher, link].filter(Boolean).join(" ");
}
