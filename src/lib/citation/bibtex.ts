import type { Source } from "@/lib/types";

const escapeTex = (value: string) =>
  value.replace(/\\/g, "\\textbackslash{}").replace(/([{}%&#_$])/g, "\\$1").replace(/~/g, "\\textasciitilde{}").replace(/\^/g, "\\textasciicircum{}");

const citeKey = (id: string) => id.replace(/[^\w-]/g, "_");

/** Uses @misc for web records and @book otherwise. Missing fields are omitted. */
export function formatBibtex(s: Source): string {
  const fields: [string, string | null][] = [
    // Double braces keep a corporate or single-string author from being split into name parts.
    ["author", s.author ? `{${escapeTex(s.author)}}` : null],
    ["title", s.title ? escapeTex(s.title) : null],
    ["year", s.year === null ? null : String(s.year)],
    ["publisher", s.publisher ? escapeTex(s.publisher) : null],
    ["pages", s.pages ? escapeTex(s.pages) : null],
    ["url", s.url], // url fields are read verbatim by biblatex and must not be escaped
    ["urldate", s.accessed_at],
  ];
  const body = fields
    .filter((f): f is [string, string] => f[1] !== null)
    .map(([k, v]) => `  ${k} = {${v}}`)
    .join(",\n");
  return `@${s.url ? "misc" : "book"}{${citeKey(s.id)},\n${body}\n}`;
}

export function formatBibtexCollection(sources: Source[]): string {
  return `${sources.map(formatBibtex).join("\n\n")}\n`;
}
