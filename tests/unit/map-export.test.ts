import { describe, expect, it } from "vitest";
import messages from "../../messages/tr.json";
import { mapCaption as caption, mapCitation as citation, wrapText, type MapCaptionInput, type MapCaptionLanguage } from "@/lib/map-citation";
import { jpegToPdf } from "@/lib/pdf";

const LANG: MapCaptionLanguage = { caption: messages.mapCaption, citation: messages.citationFormat, era: { bc: "MÖ", ad: "MS" }, appTitle: "Zaman Atlası" };
const mapCaption = (i: MapCaptionInput) => caption(i, LANG);
const mapCitation = (i: MapCaptionInput) => citation(i, LANG);

const input = { year: -331, boundaryYear: -400, url: "https://ornek.org/tr?y=-331", accessed: "2026-11-05" };

describe("map citation", () => {
  it("cites a single map with access date", () => {
    expect(mapCitation(input)).toBe("Zaman Atlası. (t.y.). MÖ 331 yılı [Harita]. 5 Kasım 2026 tarihinde https://ornek.org/tr?y=-331 adresinden erişildi.");
  });
  it("cites both years in compare mode", () => {
    expect(mapCitation({ ...input, year: 1071, year2: 1914 })).toContain("MS 1071 ve MS 1914 yılları [Harita]");
  });
  it("falls back to the bare URL without a valid date", () => {
    expect(mapCitation({ ...input, accessed: "dün" })).toMatch(/\[Harita\]\. https:\/\/ornek\.org/);
  });
});

describe("map caption", () => {
  it("names the boundary map, because it can differ from the chosen year", () => {
    const { title, lines } = mapCaption(input);
    expect(title).toBe("Zaman Atlası: MÖ 331 yılı");
    expect(lines[0]).toBe("Sınır haritası: MÖ 400");
  });
  it("always carries the required attribution and approximation note", () => {
    const text = mapCaption(input).lines.join(" ");
    for (const part of ["OpenStreetMap", "OpenMapTiles", "OpenFreeMap", "historical-basemaps", "GPL-3.0", "yaklaşıktır"]) expect(text).toContain(part);
  });
  it("lists both boundary maps in compare mode and admits unknowns", () => {
    expect(mapCaption({ ...input, year2: 1914, boundaryYear2: 1914 }).lines[0]).toBe("Sınır haritaları: MÖ 400 ve MS 1914");
    expect(mapCaption({ ...input, boundaryYear: null }).lines[0]).toBe("Sınır haritası: bilinmiyor");
  });
});

describe("wrapText", () => {
  const measure = (s: string) => s.length;
  it("breaks on spaces within the width", () => {
    expect(wrapText("bir iki üç dört", 7, measure)).toEqual(["bir iki", "üç dört"]);
  });
  it("keeps an overlong word on its own line instead of dropping it", () => {
    expect(wrapText("a https://uzun.example/adres b", 5, measure)).toEqual(["a", "https://uzun.example/adres", "b"]);
  });
  it("handles empty text", () => {
    expect(wrapText("", 10, measure)).toEqual([]);
  });
});

describe("jpegToPdf", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
  const pdf = jpegToPdf(jpeg, 200, 100);
  const text = Buffer.from(pdf).toString("latin1");

  it("has a PDF header and trailer", () => {
    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });
  it("embeds the JPEG bytes unchanged", () => {
    expect(text).toContain("/Filter /DCTDecode");
    expect(text).toContain(`/Length ${jpeg.length} `);
    expect(text).toContain(Buffer.from(jpeg).toString("latin1"));
  });
  it("sizes the page to the image ratio", () => {
    expect(text).toContain("/MediaBox [0 0 842 421.00]");
    expect(text).toContain("/Width 200 /Height 100");
  });
  it("writes a cross-reference table with exact object offsets", () => {
    const xref = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(xref, xref + 4)).toBe("xref");
    const rows = text.slice(xref).split("\n").filter((l) => / 00000 n $/.test(l));
    expect(rows).toHaveLength(5);
    rows.forEach((row, i) => {
      const offset = Number(row.slice(0, 10));
      expect(text.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
  });
  it("gives the content stream its true length", () => {
    const m = /<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/.exec(text);
    expect(Number(m?.[1])).toBe(m?.[2].length);
  });
});
