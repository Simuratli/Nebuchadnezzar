import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const count = async (page: import("@playwright/test").Page) => Number((await page.getByTestId("filter-count").textContent())?.match(/\d+/)?.[0]);

test.describe("filtre ve dışa aktarma", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tr?y=1900");
    await page.getByTestId("nav-filters").click();
    await expect(page.getByTestId("filters-panel")).toBeVisible();
  });

  test("kategori filtresi sonuçları ve haritayı daraltır, temizle geri alır", async ({ page }) => {
    const all = await count(page);
    expect(all).toBeGreaterThanOrEqual(150);
    const map = page.getByTestId("map-year");
    const visibleBefore = Number(await map.getAttribute("data-visible-events"));
    await page.getByTestId("filter-cat-antlasma").check();
    await expect.poll(() => count(page)).toBeLessThan(all);
    await expect.poll(async () => Number(await map.getAttribute("data-visible-events"))).toBeLessThan(visibleBefore);
    await page.getByTestId("filter-clear").click();
    await expect.poll(() => count(page)).toBe(all);
  });

  test("bölge filtresi uygulanır", async ({ page }) => {
    const all = await count(page);
    await page.getByTestId("filter-region-kafkasya").check();
    await expect.poll(() => count(page)).toBeLessThan(all);
    expect(await count(page)).toBeGreaterThan(0);
  });

  test("MÖ yıl aralığı yalnızca MÖ olaylarını bırakır", async ({ page }) => {
    await page.getByTestId("filter-to").fill("-1");
    await page.getByTestId("filter-to").press("Enter");
    const all = page.getByTestId("filter-result");
    await expect(all.first()).toContainText("MÖ");
    const texts = await all.allTextContents();
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) expect(text).toContain("MÖ");
  });

  test("listeden olay açılır ve yıl ona taşınır", async ({ page }) => {
    await page.getByTestId("filter-to").fill("-400");
    await page.getByTestId("filter-to").press("Enter");
    await page.getByTestId("filter-result").first().click();
    await expect(page.getByTestId("event-panel")).toBeVisible();
    await expect(page.getByTestId("year-label-year")).toContainText("MÖ");
  });

  test("CSV Türkçe karakterlerle ve BOM ile iner, GeoJSON geçerlidir", async ({ page }) => {
    await page.getByTestId("filter-cat-antlasma").check();
    const expected = await count(page);

    const [csv] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-csv").click()]);
    expect(csv.suggestedFilename()).toBe("zaman-atlasi-olaylar.csv");
    const text = await readFile((await csv.path()) as string, "utf8");
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text.trim().split("\r\n").length).toBeGreaterThanOrEqual(expected + 1);
    expect(text).toContain("Antlaşması");

    const [geo] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-geojson").click()]);
    const fc = JSON.parse(await readFile((await geo.path()) as string, "utf8"));
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(expected);
  });
});

test.describe("arama", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tr?y=1900");
  });

  test("Türkçe karakter yazmadan olay bulur ve Enter ile açar", async ({ page }) => {
    await page.getByTestId("search").fill("istanbulun fethi");
    await expect(page.getByTestId("search-result").first()).toContainText("Fethi");
    await page.getByTestId("search").press("Enter");
    await expect(page.getByTestId("event-title")).toContainText("Fethi");
    await expect(page.getByTestId("year-label-year")).toHaveText("MS 1453");
  });

  test("yazım hatasına toleranslıdır", async ({ page }) => {
    await page.getByTestId("search").fill("malazgrit");
    await expect(page.getByTestId("search-result").first()).toContainText("Malazgirt");
  });

  test("kişi bulur", async ({ page }) => {
    await page.getByTestId("search").fill("ulug bey");
    await expect(page.getByTestId("search-result").first()).toContainText("Kişi");
  });

  test("sonuç yoksa bunu söyler", async ({ page }) => {
    await page.getByTestId("search").fill("zzzzqqqq");
    await expect(page.getByText("Sonuç bulunamadı")).toBeVisible();
  });
});
