import type { Source } from "@/lib/types";
import { formatAccessDate, sentence } from "./common";

/** APA 7 using the Turkish conventions "t.y." and "erişildi". Missing fields are left out, never guessed. */
export function formatApa(s: Source): string {
  const date = `(${s.year ?? "t.y."}).`;
  const title = s.title ? sentence(s.title) : null;
  // Without an author, APA moves the title into the author position.
  const head = s.author ? [sentence(s.author), date, title] : [title, date];
  const pages = s.pages ? `s. ${s.pages}.` : null;
  const publisher = s.publisher ? sentence(s.publisher) : null;
  const accessed = formatAccessDate(s.accessed_at);
  const link = s.url ? (accessed ? `${accessed} tarihinde ${s.url} adresinden erişildi.` : s.url) : null;
  return [...head, pages, publisher, link].filter(Boolean).join(" ");
}
