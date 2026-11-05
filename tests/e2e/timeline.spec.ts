import { expect, test } from "@playwright/test";

test.describe("harita ve zaman kaydırıcı", () => {
  test("harita gerçekten çizilir ve tarayıcıda hata oluşmaz", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto("/tr?y=1500&lat=40&lng=42&z=3.6");
    const map = page.getByTestId("map-year");
    await expect(map.locator("canvas")).toBeVisible();
    const box = await map.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(200);
    await expect.poll(async () => Number(await map.getAttribute("data-rendered-boundaries")), { timeout: 40_000 }).toBeGreaterThan(5);
    expect(errors).toEqual([]);
  });

  test("URL'deki yıl ve görünüm yüklenir, sınır dosyası seçilir", async ({ page }) => {
    await page.goto("/tr?y=-331&lat=36.5&lng=43.25&z=5");
    await expect(page.getByTestId("year-label-year")).toHaveText("MÖ 331");
    await expect(page.getByTestId("map-year")).toHaveAttribute("data-boundary-year", "-400");
    await expect(page.getByText("Sınır haritası: MÖ 400")).toBeVisible();
    await expect(page).toHaveURL(/lat=36\.500/);
  });

  test("kök adres /tr'ye yönlenir", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/tr/);
  });

  test("klavye ile kaydırma URL ve sınır dosyasını günceller, yıl 0 atlanır", async ({ page }) => {
    await page.goto("/tr?y=-1");
    const thumb = page.getByTestId("slider-year");
    await expect(thumb).toHaveAttribute("aria-valuetext", "MÖ 1");
    await thumb.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("year-label-year")).toHaveText("MS 1");
    await expect(thumb).toHaveAttribute("aria-valuetext", "MS 1");
    await expect(page).toHaveURL(/y=1(&|$)/);
    await page.keyboard.press("End");
    await expect(page.getByTestId("year-label-year")).toHaveText("MS 1950");
    await expect(page.getByTestId("map-year")).toHaveAttribute("data-boundary-year", "1945");
  });

  test("oynat yılı ilerletir, durdur durdurur", async ({ page }) => {
    await page.goto("/tr?y=1000");
    await page.getByTestId("speed").selectOption("100");
    await page.getByTestId("play").click();
    await expect.poll(async () => page.getByTestId("year-label-year").textContent()).not.toBe("MS 1000");
    await page.getByTestId("play").click();
    const stopped = await page.getByTestId("year-label-year").textContent();
    await page.waitForTimeout(400);
    await expect(page.getByTestId("year-label-year")).toHaveText(stopped ?? "");
  });

  test("tema değişince sınır katmanları geri yüklenir", async ({ page }) => {
    await page.goto("/tr?y=1500");
    const map = page.getByTestId("map-year");
    await expect(map).toHaveAttribute("data-style-tick", "1", { timeout: 30_000 });
    await page.getByTestId("theme-toggle").click();
    await expect(map).toHaveAttribute("data-style-tick", "2", { timeout: 30_000 });
  });

  test("bozuk URL değerleri uygulamayı düşürmez", async ({ page }) => {
    await page.goto("/tr?y=abc&lat=999&e=%3Cscript%3E");
    await expect(page.getByTestId("year-label-year")).toHaveText("MS 1453");
  });
});
