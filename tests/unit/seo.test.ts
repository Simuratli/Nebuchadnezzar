import { describe, expect, it } from "vitest";
import { alternates, jsonLd, localizedUrl, snippet } from "@/lib/seo";

describe("alternates", () => {
  it("gives a canonical and hreflang links for every language", () => {
    const a = alternates("tr", "/events/Q1");
    expect(a.canonical).toBe(localizedUrl("tr", "/events/Q1"));
    expect(Object.keys(a.languages ?? {}).sort()).toEqual(["az", "en", "tr", "x-default"]);
    expect((a.languages as Record<string, string>)["x-default"]).toBe(localizedUrl("en", "/events/Q1"));
  });
  it("offers only languages that have their own text", () => {
    const a = alternates("tr", "/events/Q1", ["en", "tr"]);
    expect(Object.keys(a.languages ?? {}).sort()).toEqual(["en", "tr", "x-default"]);
  });
  it("falls back to an available language for x-default", () => {
    const a = alternates("tr", "/events/Q1", ["tr"]);
    expect((a.languages as Record<string, string>)["x-default"]).toBe(localizedUrl("tr", "/events/Q1"));
  });
});

describe("snippet", () => {
  it("keeps short text and collapses whitespace", () => {
    expect(snippet("Kısa  metin\nburada")).toBe("Kısa metin burada");
  });
  it("cuts at a word within the limit", () => {
    const out = snippet("word ".repeat(60));
    expect(out.length).toBeLessThanOrEqual(156);
    expect(out.endsWith("word…")).toBe(true);
  });
});

describe("jsonLd", () => {
  it("cannot close its script tag", () => {
    const out = jsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });
});
