import { expect, test } from "@playwright/test";

test.describe("dil desteği", () => {
  test("varsayılan dil İngilizcedir", async ({ page }) => {
    await page.goto("/?y=1453");
    await expect(page).toHaveURL(/\/en\b/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByTestId("nav-filters")).toHaveText("Filters");
    await expect(page.getByTestId("year-label-year")).toHaveText("1453 CE");
  });

  test("MÖ yılları her dilde kendi biçiminde yazılır", async ({ page }) => {
    await page.goto("/en?y=-331");
    await expect(page.getByTestId("year-label-year")).toHaveText("331 BCE");
    await page.goto("/tr?y=-331");
    await expect(page.getByTestId("year-label-year")).toHaveText("MÖ 331");
    await page.goto("/az?y=-331");
    await expect(page.getByTestId("year-label-year")).toHaveText("e.ə. 331");
  });

  test("dil seçici görünümü koruyarak dili değiştirir", async ({ page }) => {
    await page.goto("/en?y=1880&lat=41.000&lng=45.000&z=5.00&city=gence");
    await expect(page.getByTestId("city-title")).toHaveText("Ganja");
    await expect(page.getByTestId("city-name-now")).toContainText("Elisabethpol");

    await page.getByTestId("language").selectOption("tr");
    await expect(page).toHaveURL(/\/tr\?.*y=1880.*city=gence/);
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
    await expect(page.getByTestId("city-title")).toHaveText("Gence");
    await expect(page.getByTestId("nav-filters")).toHaveText("Filtre");

    await page.getByTestId("language").selectOption("az");
    await expect(page).toHaveURL(/\/az\?.*city=gence/);
    await expect(page.locator("html")).toHaveAttribute("lang", "az");
    await expect(page.getByTestId("city-title")).toContainText("Gəncə");
    await expect(page.getByTestId("nav-filters")).toHaveText("Filtr");
  });

  test("olay metni ve kaynağı seçili dildedir", async ({ page }) => {
    await page.goto("/en?y=1453&e=Q160077");
    await expect(page.getByTestId("event-title")).toContainText("Constantinople");
    await expect(page.getByTestId("source-item").filter({ hasText: "Wikipedia" }).first()).toBeVisible();
    await expect(page.getByTestId("language-note")).toBeHidden();

    await page.goto("/tr?y=1453&e=Q160077");
    await expect(page.getByTestId("event-title")).toContainText("Fethi");
    await expect(page.getByTestId("source-item").filter({ hasText: "Vikipedi" }).first()).toBeVisible();
  });

  test("elle yazılmış içerik çevrilidir", async ({ page }) => {
    await page.goto("/en?tour=ipek-yolu-yukselisi");
    await expect(page.getByTestId("tour-step-title")).toHaveText("The Persian Royal Road");
    await page.goto("/az?tour=ipek-yolu-yukselisi");
    await expect(page.getByTestId("tour-step-title")).toHaveText("Fars Kral Yolu");

    await page.goto("/en?y=1880&fix=erivan");
    await expect(page.getByTestId("correction-title")).toHaveText("Russian Empire");
    await expect(page.getByTestId("correction-warning")).toContainText("today's administrative boundaries");
    await page.goto("/az?y=1880&fix=erivan");
    await expect(page.getByTestId("correction-title")).toHaveText("Rusiya İmperiyası");
  });

  test("arama seçili dilde ve Azerbaycan harfleriyle çalışır", async ({ page }) => {
    await page.goto("/en");
    await page.getByTestId("search").fill("elisabethpol");
    await expect(page.getByTestId("search-result").first()).toContainText("Ganja");
    await page.goto("/az");
    await page.getByTestId("search").fill("gence");
    await expect(page.getByTestId("search-result").filter({ hasText: "Şəhər" }).first()).toContainText("Gəncə");
  });

  test("atıf ve harita dipnotu dile göre yazılır", async ({ page }) => {
    await page.goto("/en?y=1880");
    await page.getByTestId("nav-export").click();
    await expect(page.getByTestId("export-caption")).toContainText("Boundary map: 1880 CE");
    await expect(page.getByTestId("export-citation")).toContainText("[Map]");
    await expect(page.getByTestId("export-citation")).toContainText("Retrieved");
    await page.goto("/az?y=1880");
    await page.getByTestId("nav-export").click();
    await expect(page.getByTestId("export-caption")).toContainText("Sərhəd xəritəsi");
    await expect(page.getByTestId("export-citation")).toContainText("[Xəritə]");
  });

  test("bir dilde metin yoksa bunu söyler", async ({ page }) => {
    // Most events have no Azerbaijani article, so the first one without it shows the note.
    await page.goto("/az?y=1000&e=Q18692304");
    await expect(page.getByTestId("event-title")).toBeVisible();
    await expect(page.getByTestId("language-note")).toBeVisible();
  });

  test("olmayan dil 404 verir", async ({ page }) => {
    const response = await page.goto("/fr");
    expect(response?.status()).toBe(404);
  });
});
