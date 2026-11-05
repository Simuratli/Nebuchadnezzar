import { describe, expect, it } from "vitest";
import cards from "../../data/seed/event-cards.json";
import events from "../../data/seed/events.json";
import polities from "../../data/seed/polities.json";
import { cleanResult, extractInfobox, linkTargets, readSides } from "../../scripts/infobox";
import { localizeCard, localizePolity } from "@/lib/data/localize";
import { axisPosition, barSpan, existsInYear, statesByGroup } from "@/lib/polities";
import { eventCardStoreSchema, polityStoreSchema, type Polity, type StoredCard, type StoredPolity } from "@/lib/types";

const page = `{{Short description|Battle}}
{{Infobox military conflict
| conflict = Battle of Chaldiran
| partof = [[Ottoman–Persian Wars]]
| date = 23 August 1514
| result = '''[[Ottoman Empire|Ottoman]] victory'''<ref name="x">A source</ref>
* Eastern Anatolia annexed
| combatant1 = {{flag|Ottoman Empire}}
| combatant2 = {{flagicon image|Safavid.svg}} [[Safavid Iran]]
| commander1 = {{flagicon|Ottoman Empire}} [[Selim I]]<br />[[Hadım Sinan Pasha|Sinan Pasha]]
| commander2 = {{plainlist|
* [[Ismail I]] {{WIA}}
* [[Muhammad Sharaf al-Din]]{{KIA}}
}}
| image = [[File:Battle.jpg|200px]]
}}
Body text with [[Other link]].`;

describe("infobox reader", () => {
  const fields = extractInfobox(page);

  it("finds the infobox and its fields", () => {
    expect(fields?.conflict).toBe("Battle of Chaldiran");
    expect(fields?.date).toBe("23 August 1514");
  });
  it("returns null for pages without one", () => {
    expect(extractInfobox("Only {{cite}} text.")).toBeNull();
    expect(extractInfobox("{{Infobox person|name=X}}")).toBeNull();
  });
  it("does not stop at pipes inside links and templates", () => {
    expect(fields?.commander1).toContain("Sinan Pasha");
  });
  it("cleans the result of markup, references and links", () => {
    expect(cleanResult(fields?.result)).toBe("Ottoman victory; Eastern Anatolia annexed");
  });
  it("drops results that only point elsewhere", () => {
    expect(cleanResult("See [[#Aftermath|Aftermath]]")).toBeNull();
    expect(cleanResult("Inconclusive, see below section")).toBeNull();
    expect(cleanResult(undefined)).toBeNull();
    expect(cleanResult("Peace treaty")).toBe("Peace treaty");
  });
  it("shortens long results at a word", () => {
    const out = cleanResult("word ".repeat(60)) ?? "";
    expect(out.length).toBeLessThanOrEqual(161);
    expect(out.endsWith("…")).toBe(true);
  });
  it("reads link targets, turning flags into links and skipping files", () => {
    expect(linkTargets("{{flag|Ottoman Empire}}")).toEqual(["Ottoman Empire"]);
    expect(linkTargets("[[File:X.png|20px]] [[Hadım Sinan Pasha|Sinan]]")).toEqual(["Hadım Sinan Pasha"]);
    expect(linkTargets("[[A]] [[A|again]] [[B#Section|b]]")).toEqual(["A", "B"]);
  });
  it("keeps labelled links intact inside list templates", () => {
    expect(linkTargets("{{plainlist|\n* [[Macedonia (ancient kingdom)|Macedonia]]\n* [[League of Corinth|Hellenic League]]\n}}")).toEqual(["Macedonia (ancient kingdom)", "League of Corinth"]);
  });
  it("skips links to other wikis", () => {
    expect(linkTargets("[[:tr:Beylerbeyi Hasan Paşa|Hasan Pasha]] [[Selim I]]")).toEqual(["Selim I"]);
  });
  it("keeps opposing sides apart", () => {
    expect(readSides(fields ?? {})).toEqual([
      { parties: ["Ottoman Empire"], commanders: ["Selim I", "Hadım Sinan Pasha"] },
      { parties: ["Safavid Iran"], commanders: ["Ismail I", "Muhammad Sharaf al-Din"] },
    ]);
  });
});

describe("cards", () => {
  const all = cards as unknown as Record<string, StoredCard>;
  it("satisfy the schema and belong to existing events", () => {
    eventCardStoreSchema.parse(cards);
    const ids = new Set(events.map((e) => e.id));
    for (const id of Object.keys(all)) expect(ids.has(id), id).toBe(true);
  });
  it("contain no names broken by the wiki markup", () => {
    for (const [id, card] of Object.entries(all)) {
      for (const n of card.sides.flatMap((s) => [...s.parties, ...s.commanders])) {
        expect(n.en ?? "", id).not.toMatch(/\n|^:|\[\[|\{\{/);
      }
    }
  });
  it("cover most wars and treaties", () => {
    const of = (c: string) => events.filter((e) => e.category === c);
    expect(of("savas").filter((e) => all[e.id]).length).toBeGreaterThan(of("savas").length * 0.8);
    expect(of("antlasma").filter((e) => all[e.id]).length).toBeGreaterThan(of("antlasma").length * 0.6);
  });
  it("localize names and fall back when a language is missing", () => {
    const card = localizeCard(
      { parties: [{ en: "Ottoman Empire", tr: "Osmanlı", qid: "Q1" }, { en: "Only English" }], part_of: [], places: [], signatories: [], sides: [], result: "Victory" },
      "tr",
    );
    expect(card?.parties).toEqual([{ name: "Osmanlı", qid: "Q1" }, { name: "Only English", qid: null }]);
    expect(card?.result).toBe("Victory");
    expect(localizeCard(undefined, "en")).toBeNull();
  });
});

describe("states timeline", () => {
  const stored = polities as unknown as StoredPolity[];
  const local = stored.map((p) => localizePolity(p, "en"));
  const byId = (id: string) => local.find((p) => p.id === id) as Polity;

  it("has valid records with unique ids and ordered dates", () => {
    polityStoreSchema.parse(polities);
    expect(new Set(stored.map((p) => p.id)).size).toBe(stored.length);
    for (const p of stored) if (p.to !== null) expect(p.to, p.id).toBeGreaterThan(p.from);
    expect(stored.length).toBeGreaterThanOrEqual(40);
  });
  it("has known dates right", () => {
    expect(byId("osmanli")).toMatchObject({ from: 1299, to: 1922 });
    expect(byId("safevi")).toMatchObject({ from: 1501, to: 1736 });
    expect(byId("turkiye").to).toBeNull();
  });
  it("names every state in every language", () => {
    for (const locale of ["en", "tr", "az"] as const) {
      for (const p of stored) expect(localizePolity(p, locale).name, p.id).toBeTruthy();
    }
    expect(localizePolity(stored.find((p) => p.id === "safevi") as StoredPolity, "tr").name).toContain("Safev");
  });
  it("decides existence by year, with the end year exclusive", () => {
    expect(existsInYear(byId("osmanli"), 1299)).toBe(true);
    expect(existsInYear(byId("osmanli"), 1921)).toBe(true);
    expect(existsInYear(byId("osmanli"), 1922)).toBe(false);
    expect(existsInYear(byId("turkiye"), 1950)).toBe(true);
  });
  it("shows the Ottoman, Safavid and Timurid overlap the chart exists for", () => {
    const at = (y: number) => local.filter((p) => existsInYear(p, y)).map((p) => p.id);
    expect(at(1505)).toEqual(expect.arrayContaining(["osmanli", "safevi", "timurlu"]));
  });
  it("places bars on the axis and marks states running past it", () => {
    expect(axisPosition(-500)).toBe(0);
    expect(axisPosition(1950)).toBe(100);
    expect(axisPosition(-9999)).toBe(0);
    expect(barSpan(byId("ahameniş"))).toMatchObject({ left: 0, openLeft: true, openRight: false });
    expect(barSpan(byId("turkiye"))).toMatchObject({ openRight: true });
    const b = barSpan(byId("osmanli"));
    expect(b.left + b.width).toBeCloseTo(axisPosition(1922));
  });
  it("groups rows oldest first", () => {
    const iran = statesByGroup(local).iran;
    expect(iran[0].id).toBe("ahameniş");
    expect(iran.map((p) => p.from)).toEqual([...iran.map((p) => p.from)].sort((a, b) => a - b));
  });
});
