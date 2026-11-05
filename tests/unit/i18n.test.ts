import { describe, expect, it } from "vitest";
import content from "../../data/i18n/content.json";
import cities from "../../data/seed/cities.json";
import corrections from "../../data/seed/corrections.json";
import events from "../../data/seed/events.json";
import people from "../../data/seed/people.json";
import routes from "../../data/seed/routes.json";
import tours from "../../data/seed/tours.json";
import az from "../../messages/az.json";
import en from "../../messages/en.json";
import tr from "../../messages/tr.json";
import { formatApa } from "@/lib/citation/apa";
import { formatChicago } from "@/lib/citation/chicago";
import { localizeCity, localizeCorrection, localizeEvent, localizePerson, localizeRoute, localizeSources, localizeTour, translate } from "@/lib/data/localize";
import { foldText } from "@/lib/search";
import { DEFAULT_LOCALE, LOCALES, type Correction, type HistoricalRoute, type Source, type StoredCity, type StoredEvent, type StoredPerson, type Tour } from "@/lib/types";
import { formatYear } from "@/lib/year";

const flatten = (o: object, prefix = ""): Record<string, unknown> =>
  Object.entries(o).reduce<Record<string, unknown>>((acc, [k, v]) => {
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(acc, flatten(v, `${prefix}${k}.`));
    else acc[`${prefix}${k}`] = v;
    return acc;
  }, {});
const placeholders = (s: unknown) => (typeof s === "string" ? (s.match(/\{\w+\}/g) ?? []).sort() : []);

describe("messages", () => {
  const base = flatten(en);
  it("default to English and offer three languages", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect([...LOCALES]).toEqual(["en", "tr", "az"]);
  });
  for (const [name, messages] of [["tr", tr], ["az", az]] as const) {
    const other = flatten(messages);
    it(`${name} has exactly the English keys`, () => {
      expect(Object.keys(other).sort()).toEqual(Object.keys(base).sort());
    });
    it(`${name} uses the same placeholders`, () => {
      for (const key of Object.keys(base)) expect(placeholders(other[key]), key).toEqual(placeholders(base[key]));
    });
    it(`${name} is really translated`, () => {
      const same = Object.keys(base).filter((k) => typeof base[k] === "string" && base[k] === other[k] && (base[k] as string).length > 12);
      // Only the placeholder-only date range may match.
      expect(same.sort()).toEqual(["search.lived"]);
    });
  }
});

describe("hand-written content", () => {
  const dict = content as Record<string, { en?: string; az?: string }>;
  const strings = new Set<string>();
  for (const r of routes as HistoricalRoute[]) {
    strings.add(r.title);
    for (const w of r.waypoints) strings.add(w.place).add(w.note);
  }
  for (const t of tours as Tour[]) {
    strings.add(t.title).add(t.description);
    for (const s of t.steps) strings.add(s.title).add(s.text);
  }
  for (const c of corrections as Correction[]) {
    for (const s of c.slices) {
      strings.add(s.name);
      if (s.note) strings.add(s.note);
    }
  }
  for (const c of cities as StoredCity[]) {
    for (const p of c.periods) strings.add(p.name);
    for (const n of c.other_names) strings.add(n);
    // Automatic ruler names come from the English boundary data; manual ones are authored here.
    for (const r of c.rulers) if (r.manual && r.name) strings.add(r.name);
  }

  it("is translated into English and Azerbaijani", () => {
    const missing = [...strings].filter((s) => !dict[s]?.en || !dict[s]?.az);
    expect(missing).toEqual([]);
  });
  it("has no stale entries", () => {
    expect(Object.keys(dict).filter((k) => !strings.has(k))).toEqual([]);
  });
  it("translates and leaves Turkish alone", () => {
    expect(translate("Rus İmparatorluğu", "en")).toBe("Russian Empire");
    expect(translate("Rus İmparatorluğu", "az")).toBe("Rusiya İmperiyası");
    expect(translate("Rus İmparatorluğu", "tr")).toBe("Rus İmparatorluğu");
    expect(translate("Ottoman Empire", "az")).toBe("Ottoman Empire");
  });
  it("localizes routes, tours and corrections", () => {
    expect(localizeRoute((routes as HistoricalRoute[])[1], "en").title).toBe("Ibn Battuta: from Tangier to Delhi");
    expect(localizeTour((tours as Tour[])[0], "az").title).toBe("İpək Yolunun yüksəlişi");
    const fix = (corrections as Correction[]).find((c) => c.id === "erivan") as Correction;
    expect(localizeCorrection(fix, "en").slices[0].name).toBe("Erivan Khanate (Iran)");
    expect(localizeCorrection(fix, "az").slices[1].name).toBe("Rusiya İmperiyası");
  });
});

describe("localizing records", () => {
  const event: StoredEvent = {
    id: "x",
    start_year: 1000,
    end_year: null,
    date_precision: "year",
    geometry: { type: "Point", coordinates: [30, 40] },
    category: "savas",
    region_tags: ["osmanli"],
    wikidata_id: null,
    image_url: null,
    needs_review: false,
    i18n: {
      en: { title: "Siege", summary: "English summary", description: "English text" },
      tr: { title: "Kuşatma", summary: "Türkçe özet", description: "Türkçe metin" },
      az: { title: "Mühasirə" },
    },
  };
  it("serves the requested language", () => {
    expect(localizeEvent(event, "tr")).toMatchObject({ title: "Kuşatma", summary: "Türkçe özet", description: "Türkçe metin", content_lang: "tr" });
  });
  it("falls back to English text but keeps a local title, and says so", () => {
    expect(localizeEvent(event, "az")).toMatchObject({ title: "Mühasirə", summary: "English summary", description: "English text", content_lang: "en" });
  });
  it("falls back beyond English when that is all there is", () => {
    const onlyTr = { ...event, i18n: { tr: event.i18n.tr } };
    expect(localizeEvent(onlyTr, "en")).toMatchObject({ title: "Kuşatma", content_lang: "tr" });
  });
  it("picks the article in the best language and names untitled records", () => {
    const common = { event_id: "x", type: "ansiklopedi", author: null, year: null, pages: null, reliability: 1, accessed_at: null, needs_review: false, url: null } as const;
    const sources: Source[] = [
      { ...common, id: "d", title: null, publisher: "Wikidata", lang: null },
      { ...common, id: "e", title: "Siege", publisher: "Wikipedia", lang: "en" },
      { ...common, id: "t", title: "Kuşatma", publisher: "Vikipedi", lang: "tr" },
    ];
    expect(localizeSources(sources, "tr", "Kuşatma").map((s) => s.id)).toEqual(["d", "t"]);
    expect(localizeSources(sources, "az", "Mühasirə").map((s) => s.id)).toEqual(["d", "e"]);
    expect(localizeSources(sources, "az", "Mühasirə")[0].title).toBe("Mühasirə");
  });
  it("gives real data a name in every language", () => {
    for (const locale of LOCALES) {
      for (const e of events as StoredEvent[]) expect(localizeEvent(e, locale).title, e.id).toBeTruthy();
      for (const p of people as StoredPerson[]) expect(localizePerson(p, locale).name, p.id).toBeTruthy();
      for (const c of cities as StoredCity[]) expect(localizeCity(c, locale).name, c.id).toBeTruthy();
    }
  });
  it("localizes the user's example city", () => {
    const gence = (cities as StoredCity[]).find((c) => c.id === "gence") as StoredCity;
    expect(localizeCity(gence, "tr").name).toBe("Gence");
    expect(localizeCity(gence, "en").name).toBe("Ganja");
    expect(localizeCity(gence, "az").name).toMatch(/Gəncə/);
    expect(localizeCity(gence, "en").periods[1].name).toBe("Elisabethpol");
  });
});

describe("formats per language", () => {
  const web: Source = { id: "w", event_id: "x", type: "ansiklopedi", author: null, title: "Siege", year: null, publisher: "Wikipedia", url: "https://x.org/a", pages: null, reliability: 1, accessed_at: "2026-11-05", needs_review: false, lang: "en" };
  it("writes years the way each language does", () => {
    expect(formatYear(-331, { bc: en.era.bc, ad: en.era.ad, suffix: true })).toBe("331 BCE");
    expect(formatYear(1453, { bc: en.era.bc, ad: en.era.ad, suffix: true })).toBe("1453 CE");
    expect(formatYear(-331, { bc: tr.era.bc, ad: tr.era.ad })).toBe("MÖ 331");
    expect(formatYear(-331, { bc: az.era.bc, ad: az.era.ad })).toBe("e.ə. 331");
  });
  it("cites in each language", () => {
    expect(formatApa(web, en.citationFormat)).toBe("Siege. (n.d.). Wikipedia. Retrieved November 5, 2026, from https://x.org/a");
    expect(formatApa(web, tr.citationFormat)).toContain("5 Kasım 2026 tarihinde https://x.org/a adresinden erişildi.");
    expect(formatApa(web, az.citationFormat)).toContain("5 noyabr 2026 tarixində https://x.org/a ünvanından əldə edilib.");
    expect(formatChicago(web, en.citationFormat)).toContain("Accessed November 5, 2026.");
    expect(formatChicago(web, az.citationFormat)).toContain("Giriş tarixi: 5 noyabr 2026.");
  });
  it("folds Azerbaijani letters for search", () => {
    expect(foldText("Gəncə")).toBe("gence");
    expect(foldText("Şəki")).toBe("seki");
  });
});
