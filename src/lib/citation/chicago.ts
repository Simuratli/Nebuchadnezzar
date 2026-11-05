import type { Source } from "@/lib/types";
import { formatAccessDate, sentence } from "./common";

/** Chicago bibliography style. Missing fields are left out, never guessed. */
export function formatChicago(s: Source): string {
  const author = s.author ? sentence(s.author) : null;
  const title = s.title ? (s.url ? `"${sentence(s.title)}"` : sentence(s.title)) : null;
  const imprint = [s.publisher, s.year].filter(Boolean).join(", ");
  const pages = s.pages ? `${s.pages}.` : null;
  const accessed = formatAccessDate(s.accessed_at);
  return [author, title, imprint ? `${imprint}.` : null, pages, accessed ? `Erişim ${accessed}.` : null, s.url ? `${s.url}.` : null]
    .filter(Boolean)
    .join(" ");
}
