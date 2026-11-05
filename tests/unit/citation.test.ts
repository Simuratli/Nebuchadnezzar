import { describe, expect, it } from "vitest";
import { formatApa } from "@/lib/citation/apa";
import { formatBibtex, formatBibtexCollection } from "@/lib/citation/bibtex";
import { formatChicago } from "@/lib/citation/chicago";
import { formatAccessDate, missingFields } from "@/lib/citation/common";
import type { Source } from "@/lib/types";
import messages from "../../messages/tr.json";

const T = messages.citationFormat;

const wiki: Source = {
  id: "Q1-trwiki",
  event_id: "Q1",
  type: "ansiklopedi",
  author: null,
  title: "İstanbul'un Fethi",
  year: null,
  publisher: "Vikipedi",
  url: "https://tr.wikipedia.org/wiki/X",
  pages: null,
  reliability: 1,
  accessed_at: "2026-11-05",
  needs_review: false,
  lang: null,
};

const book: Source = {
  ...wiki,
  id: "b1",
  type: "ikincil",
  author: "Yazar, A.",
  title: "Örnek Kitap",
  year: 1999,
  publisher: "Yayınevi",
  url: null,
  pages: "10-20",
  reliability: 3,
  accessed_at: null,
};

const empty: Source = { ...book, id: "e1", author: null, title: null, year: null, publisher: null, pages: null };

describe("APA", () => {
  it("formats a book", () => {
    expect(formatApa(book, T)).toBe("Yazar, A. (1999). Örnek Kitap. s. 10-20. Yayınevi.");
  });
  it("moves the title first and uses t.y. for an authorless, undated web page", () => {
    expect(formatApa(wiki, T)).toBe(
      "İstanbul'un Fethi. (t.y.). Vikipedi. 5 Kasım 2026 tarihinde https://tr.wikipedia.org/wiki/X adresinden erişildi.",
    );
  });
  it("never invents values for empty records", () => {
    expect(formatApa(empty, T)).toBe("(t.y.).");
  });
});

describe("Chicago", () => {
  it("formats a book", () => {
    expect(formatChicago(book, T)).toBe("Yazar, A. Örnek Kitap. Yayınevi, 1999. 10-20.");
  });
  it("formats a web page with access date", () => {
    expect(formatChicago(wiki, T)).toBe('"İstanbul\'un Fethi." Vikipedi. Erişim 5 Kasım 2026. https://tr.wikipedia.org/wiki/X.');
  });
  it("yields an empty string rather than placeholders", () => {
    expect(formatChicago(empty, T)).toBe("");
  });
});

describe("BibTeX", () => {
  it("formats a book", () => {
    expect(formatBibtex(book)).toBe(
      "@book{b1,\n  author = {{Yazar, A.}},\n  title = {Örnek Kitap},\n  year = {1999},\n  publisher = {Yayınevi},\n  pages = {10-20}\n}",
    );
  });
  it("formats a web record and omits missing fields", () => {
    const out = formatBibtex(wiki);
    expect(out.startsWith("@misc{Q1-trwiki,")).toBe(true);
    expect(out).toContain("urldate = {2026-11-05}");
    expect(out).not.toContain("author");
    expect(out).not.toContain("year");
  });
  it("escapes special characters but leaves the URL verbatim", () => {
    const out = formatBibtex({ ...wiki, title: "A & B_C 100%", url: "https://x.org/a_b%20c" });
    expect(out).toContain("title = {A \\& B\\_C 100\\%}");
    expect(out).toContain("url = {https://x.org/a_b%20c}");
  });
  it("sanitises the cite key", () => {
    expect(formatBibtex({ ...book, id: "a b,c" })).toContain("@book{a_b_c,");
  });
  it("joins a collection", () => {
    expect(formatBibtexCollection([book, wiki]).match(/^@/gm)).toHaveLength(2);
  });
});

describe("helpers", () => {
  it("formats access dates and rejects other strings", () => {
    expect(formatAccessDate("2026-01-09", T)).toBe("9 Ocak 2026");
    expect(formatAccessDate("dün", T)).toBeNull();
    expect(formatAccessDate("2026-13-01", T)).toBeNull();
    expect(formatAccessDate(null, T)).toBeNull();
  });
  it("reports missing fields by source type", () => {
    expect(missingFields(wiki)).toEqual([]);
    expect(missingFields(book)).toEqual([]);
    expect(missingFields(empty)).toEqual(["author", "title", "year", "publisher"]);
    expect(missingFields({ ...wiki, publisher: null })).toEqual(["publisher"]);
  });
});
