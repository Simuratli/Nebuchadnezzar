import { expect, test, type APIRequestContext } from "@playwright/test";
import events from "../../data/seed/events.json";

// These read raw HTML without running JavaScript, the way a basic crawler sees a page.
const html = async (request: APIRequestContext, path: string) => {
  const res = await request.get(path);
  expect(res.status(), path).toBe(200);
  return res.text();
};
const meta = (page: string, pattern: RegExp) => pattern.exec(page)?.[1];

/** An event with text in English but none in Azerbaijani. */
const partial = events.find((e) => {
  const i = e.i18n as Record<string, { summary?: string } | undefined>;
  return i.en?.summary && !i.az?.summary && !i.tr?.summary;
});

test.describe("arama motorları", () => {
  test("ana sayfanın başlığı, açıklaması ve metni JavaScript olmadan görünür", async ({ request }) => {
    const page = await html(request, "/en");
    expect(meta(page, /<title>([^<]*)<\/title>/)).toContain("Caucasus");
    expect(page).toMatch(/<meta name="description" content="[^"]{50,}"/);
    expect(page).toMatch(/<html[^>]*lang="en"/);
    expect(page).toMatch(/<h1[^>]*>[^<]*Nebuchadnezzar/);
    expect(page).toContain("/en/explore");
  });

  test("canonical, dil alternatifleri ve sosyal etiketler vardır", async ({ request }) => {
    const page = await html(request, "/tr");
    expect(page).toMatch(/<link rel="canonical" href="[^"]*\/tr"/);
    for (const lang of ["en", "tr", "az", "x-default"]) expect(page).toContain(`hrefLang="${lang}"`);
    expect(page).toContain('property="og:title"');
    expect(page).toContain('property="og:image"');
    expect(page).toContain('name="twitter:card"');
  });

  test("durum parametreleri canonical adresi değiştirmez", async ({ request }) => {
    const page = await html(request, "/en?y=1453&lat=40&lng=30&z=5");
    expect(page).toMatch(/<link rel="canonical" href="[^"?]*\/en"/);
  });

  test("olay sayfası içeriği sunucudan gelir", async ({ request }) => {
    const page = await html(request, "/en/events/Q160077");
    expect(meta(page, /<title>([^<]*)<\/title>/)).toContain("Constantinople");
    expect(page).toMatch(/<h1[^>]*>[^<]*Constantinople/);
    expect(page).toContain("Mehmed");
    expect(page).toContain("wikipedia.org");
    expect(page).toMatch(/<link rel="canonical" href="[^"]*\/en\/events\/Q160077"/);
  });

  test("yapılandırılmış veri geçerli JSON'dır", async ({ request }) => {
    for (const [path, type] of [["/en/events/Q160077", "Article"], ["/en/people/ibn-battuta", "Person"], ["/en/cities/gence", "City"]]) {
      const page = await html(request, path);
      const raw = meta(page, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      expect(raw, path).toBeTruthy();
      const data = JSON.parse(raw as string);
      expect(data["@type"]).toBe(type);
      expect(data.description, path).toBeTruthy();
    }
  });

  test("şehir sayfası eski adları içerir", async ({ request }) => {
    const page = await html(request, "/en/cities/gence");
    expect(page).toContain("Elisabethpol");
    expect(page).toContain("Kirovabad");
  });

  test("yedek dilde açılan sayfa dizine kapalıdır, kendi dilindeki açıktır", async ({ request }) => {
    expect(partial).toBeTruthy();
    const own = await html(request, `/en/events/${partial?.id}`);
    expect(own).not.toMatch(/name="robots" content="noindex/);
    const fallback = await html(request, `/az/events/${partial?.id}`);
    expect(fallback).toMatch(/name="robots" content="noindex/);
    expect(fallback).not.toContain('hrefLang="az"');
  });

  test("olmayan kayıt 404 verir", async ({ request }) => {
    expect((await request.get("/en/events/Q999999999")).status()).toBe(404);
    expect((await request.get("/en/people/yok")).status()).toBe(404);
    expect((await request.get("/en/cities/yok")).status()).toBe(404);
  });

  test("dizin sayfası tüm kayıtlara bağlantı verir", async ({ request }) => {
    const page = await html(request, "/tr/explore");
    expect(page).toContain("/tr/people/ibn-battuta");
    expect(page).toContain("/tr/cities/gence");
    expect(page).toContain("/tr/events/Q160077");
  });

  test("sitemap yalnızca kendi dilindeki sayfaları listeler", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("/en/events/Q160077");
    expect(xml).toContain("/tr/events/Q160077");
    expect(xml).toContain("/en/explore");
    expect(xml).toContain(`/en/events/${partial?.id}`);
    expect(xml).not.toContain(`<loc>http://localhost:3000/az/events/${partial?.id}</loc>`);
    expect((xml.match(/<loc>/g) ?? []).length).toBeGreaterThan(1000);
  });

  test("robots dosyası API'yi kapatır ve sitemap'i gösterir", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain("Disallow: /api/");
    expect(text).toContain("/sitemap.xml");
  });

  test("içerik sayfasından haritaya dönülür, harita olayı açar", async ({ page }) => {
    await page.goto("/en/events/Q160077");
    await page.getByTestId("view-on-map").click();
    await expect(page.getByTestId("event-title")).toContainText("Constantinople");
  });

  test("haritadan dizine ulaşılır", async ({ page }) => {
    await page.goto("/en");
    await page.getByTestId("nav-explore").click();
    await expect(page).toHaveURL(/\/en\/explore/);
    await expect(page.getByTestId("explore-people")).toContainText("Ibn Battuta");
  });
});
