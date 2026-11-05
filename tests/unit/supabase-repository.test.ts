import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseRepository } from "@/lib/data/supabase-repository";

// Stubs the HTTP layer only. This checks the adapter's own logic, not a real database.
const summary = (id: string) => ({
  id,
  title: `Olay ${id}`,
  summary: "",
  start_year: 1453,
  end_year: null,
  date_precision: "year",
  geometry: { type: "Point", coordinates: [28.97, 41.01] },
  category: "savas",
  region_tags: ["osmanli"],
  wikidata_id: null,
  image_url: null,
  content_lang: "tr",
  needs_review: false,
});

const source = (id: string, event_id: string) => ({
  id,
  event_id,
  type: "ansiklopedi",
  author: null,
  title: "Başlık",
  year: null,
  publisher: "Vikipedi",
  url: "https://tr.wikipedia.org/wiki/X",
  pages: null,
  reliability: 1,
  accessed_at: "2026-11-05",
  needs_review: false,
});

describe("Supabase repository", () => {
  const requests: URL[] = [];
  let respond: (url: URL) => unknown;

  beforeEach(() => {
    requests.length = 0;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : input);
        requests.push(url);
        return new Response(JSON.stringify(respond(url)), { status: 200, headers: { "Content-Type": "application/json" } });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("requires its environment variables", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(() => createSupabaseRepository()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("reads events without the description column", async () => {
    respond = () => [summary("a")];
    const events = await createSupabaseRepository().listEvents();
    expect(events.map((e) => e.id)).toEqual(["a"]);
    expect(requests[0].searchParams.get("select")).not.toContain("description");
  });

  it("keeps paging until a short page arrives", async () => {
    let call = 0;
    respond = () => {
      call++;
      return call === 1 ? Array.from({ length: 1000 }, (_, i) => summary(`e${i}`)) : [summary("last")];
    };
    const events = await createSupabaseRepository().listEvents();
    expect(events).toHaveLength(1001);
    expect(call).toBe(2);
  });

  it("rejects rows that do not match the schema instead of passing them on", async () => {
    respond = () => [{ ...summary("a"), start_year: 0 }];
    await expect(createSupabaseRepository().listEvents()).rejects.toThrow();
  });

  it("splits large source requests", async () => {
    respond = (url) => (url.pathname.endsWith("/sources") ? [source(`s${requests.length}`, "e")] : []);
    const ids = Array.from({ length: 250 }, (_, i) => `e${i}`);
    const sources = await createSupabaseRepository().getSources(ids);
    expect(requests).toHaveLength(3);
    expect(sources).toHaveLength(3);
  });
});
