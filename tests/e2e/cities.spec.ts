import { expect, test } from "@playwright/test";

test.describe("şehir zaman çizelgesi", () => {
  test("aramadan açılır; eski adlar, yönetim uyarısı ve kaynaklar görünür", async ({ page }) => {
    await page.goto("/tr?y=1880");
    await page.getByTestId("search").fill("gence");
    await page.getByTestId("search-result").filter({ hasText: "Şehir" }).first().click();
    await expect(page.getByTestId("city-title")).toHaveText("Gence");
    await expect(page).toHaveURL(/city=gence/);

    const periods = page.getByTestId("city-periods");
    await expect(periods).toContainText("Yelizavetpol");
    await expect(periods).toContainText("Kirovabad");
    await expect(page.getByTestId("city-name-now")).toContainText("Yelizavetpol");

    await expect(page.getByTestId("city-rulers-warning")).toBeVisible();
    await expect(page.getByTestId("city-rulers")).toContainText("Rus İmparatorluğu");
    await expect(page.getByTestId("city-rulers")).toContainText("elle düzeltildi");
    await expect(page.getByTestId("source-item").first()).toBeVisible();
  });

  test("yıl değişince şehrin o yılki adı değişir", async ({ page }) => {
    await page.goto("/tr?y=1950&city=gence");
    await expect(page.getByTestId("city-name-now")).toContainText("Kirovabad");
    const thumb = page.getByTestId("slider-year");
    await thumb.focus();
    await page.keyboard.press("Home");
    await expect(page.getByTestId("city-name-now")).toContainText("Gence");
  });

  test("şehrin olayları listelenir ve tıklanınca olay açılır", async ({ page }) => {
    await page.goto("/tr?y=1453&city=istanbul");
    await expect(page.getByTestId("city-event").first()).toBeVisible();
    await page.getByTestId("city-event").filter({ hasText: "Fethi" }).first().click();
    await expect(page.getByTestId("event-title")).toContainText("Fethi");
    await expect(page.getByTestId("city-panel")).toBeHidden();
    await expect(page).not.toHaveURL(/city=/);
  });

  test("yönetim satırı yılı o döneme taşır", async ({ page }) => {
    await page.goto("/tr?y=1000&city=gence");
    await page.getByTestId("city-rulers").getByText("Rus ilhakı sürüyor").click();
    await expect(page.getByTestId("year-label-year")).toHaveText("MS 1804");
  });

  test("haritadaki şehir noktasına tıklanınca panel açılır", async ({ page }) => {
    await page.goto("/tr?y=1880&lat=40.68&lng=46.36&z=7&e=");
    const map = page.getByTestId("map-year");
    await expect.poll(async () => await map.getAttribute("data-city-at-center"), { timeout: 40_000 }).toBe("gence");
    const box = await map.boundingBox();
    if (!box) throw new Error("no box");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId("city-title")).toHaveText("Gence");
  });

  test("olmayan şehir kimliği yok sayılır", async ({ page }) => {
    await page.goto("/tr?city=yok");
    await expect(page.getByTestId("year-label-year")).toBeVisible();
    await expect(page.getByTestId("city-panel")).toBeHidden();
  });
});
