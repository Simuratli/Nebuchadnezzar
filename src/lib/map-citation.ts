import { fill, formatAccessDate, type CitationText } from "./citation/common";
import { isCorrectedYear } from "./corrections";
import { formatYear, type Era } from "./year";

export type MapCaptionInput = {
  year: number;
  /** Second year in compare mode. */
  year2?: number;
  boundaryYear: number | null;
  boundaryYear2?: number | null;
  url: string;
  /** ISO date, for example 2026-11-05. */
  accessed: string;
};

/** A language's caption wording, kept in messages/<locale>.json under mapCaption. */
export type MapCaptionText = {
  yearOne: string;
  yearTwo: string;
  kind: string;
  boundaryOne: string;
  boundaryTwo: string;
  unknown: string;
  attribution: string;
  correction: string;
  citationLabel: string;
};

export type MapCaptionLanguage = { caption: MapCaptionText; citation: CitationText; era: Era; appTitle: string };

const viewTitle = ({ year, year2 }: MapCaptionInput, { caption, era }: MapCaptionLanguage) =>
  year2 === undefined
    ? fill(caption.yearOne, { year: formatYear(year, era) })
    : fill(caption.yearTwo, { year: formatYear(year, era), year2: formatYear(year2, era) });

export function mapCitation(input: MapCaptionInput, lang: MapCaptionLanguage): string {
  const accessed = formatAccessDate(input.accessed, lang.citation);
  const link = accessed ? fill(lang.citation.retrieved, { date: accessed, url: input.url }) : input.url;
  return `${lang.appTitle}. (${lang.citation.noDate}). ${viewTitle(input, lang)} [${lang.caption.kind}]. ${link}`;
}

/** The lines printed under an exported map. */
export function mapCaption(input: MapCaptionInput, lang: MapCaptionLanguage): { title: string; lines: string[] } {
  const { caption, era } = lang;
  const boundary = (y: number | null | undefined) => (y === null || y === undefined ? caption.unknown : formatYear(y, era));
  const boundaryLine =
    input.year2 === undefined
      ? fill(caption.boundaryOne, { year: boundary(input.boundaryYear) })
      : fill(caption.boundaryTwo, { year: boundary(input.boundaryYear), year2: boundary(input.boundaryYear2) });
  return {
    title: `${lang.appTitle}: ${viewTitle(input, lang)}`,
    lines: [
      boundaryLine,
      caption.attribution,
      ...(isCorrectedYear(input.year) || (input.year2 !== undefined && isCorrectedYear(input.year2)) ? [caption.correction] : []),
      `${caption.citationLabel}: ${mapCitation(input, lang)}`,
    ],
  };
}

/** Splits text into lines no wider than maxWidth, as measured by the caller. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
