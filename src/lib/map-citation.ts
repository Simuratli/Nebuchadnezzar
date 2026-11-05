import { formatAccessDate } from "./citation/common";
import { formatYear } from "./year";

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

export const MAP_ATTRIBUTION =
  "Taban harita: OpenFreeMap, OpenMapTiles, OpenStreetMap katkıcıları. Sınırlar: historical-basemaps (A. Ourednik ve katkıcılar, GPL-3.0), yaklaşıktır.";

const viewTitle = ({ year, year2 }: MapCaptionInput) =>
  year2 === undefined ? `${formatYear(year)} yılı` : `${formatYear(year)} ve ${formatYear(year2)} yılları`;

/** "Zaman Atlası. (t.y.). MS 1453 yılı [Harita]. 5 Kasım 2026 tarihinde ... adresinden erişildi." */
export function mapCitation(input: MapCaptionInput): string {
  const accessed = formatAccessDate(input.accessed);
  const link = accessed ? `${accessed} tarihinde ${input.url} adresinden erişildi.` : input.url;
  return `Zaman Atlası. (t.y.). ${viewTitle(input)} [Harita]. ${link}`;
}

/** The lines printed under an exported map. */
export function mapCaption(input: MapCaptionInput): { title: string; lines: string[] } {
  const boundary = (y: number | null | undefined) => (y === null || y === undefined ? "bilinmiyor" : formatYear(y));
  const boundaryLine =
    input.year2 === undefined
      ? `Sınır haritası: ${boundary(input.boundaryYear)}`
      : `Sınır haritaları: ${boundary(input.boundaryYear)} ve ${boundary(input.boundaryYear2)}`;
  return {
    title: `Zaman Atlası: ${viewTitle(input)}`,
    lines: [boundaryLine, MAP_ATTRIBUTION, `Atıf: ${mapCitation(input)}`],
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
