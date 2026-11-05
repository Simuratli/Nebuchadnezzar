import { expect, test } from "@playwright/test";

test.describe("mobil", () => {
  test("detay paneli alttan açılan sheet olarak görünür, harita görünür kalır", async ({ page }) => {
    await page.goto("/tr?y=1453&e=Q160077");
    const panel = page.getByTestId("event-panel");
    await expect(page.getByTestId("event-title")).toContainText("Fethi");
    const viewport = page.viewportSize();
    const box = await panel.boundingBox();
    expect(box?.width).toBe(viewport?.width);
    expect((box?.y ?? 0) + 40).toBeGreaterThan((viewport?.height ?? 0) * 0.2);
    const map = await page.getByTestId("map-year").boundingBox();
    expect(map?.height ?? 0).toBeGreaterThan(200);
  });

  test("sayfada yatay kaydırma yok", async ({ page }) => {
    await page.goto("/tr");
    await expect(page.getByTestId("slider-year")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("zaman ekseni etiketleri üst üste binmez", async ({ page }) => {
    await page.goto("/tr");
    await expect(page.getByTestId("slider-year")).toBeVisible();
    const boxes = await page.getByTestId("tick").evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0).map((r) => [r.left, r.right]),
    );
    expect(boxes.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < boxes.length; i++) expect(boxes[i][0]).toBeGreaterThanOrEqual(boxes[i - 1][1]);
  });

  test("zaman kaydırıcısı ve yan paneller kullanılabilir", async ({ page }) => {
    await page.goto("/tr?y=1000");
    await page.getByTestId("slider-year").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("year-label-year")).toHaveText("MS 1001");
    await page.getByTestId("nav-filters").click();
    await expect(page.getByTestId("filters-panel")).toBeVisible();
    await page.getByTestId("side-close").click();
    await expect(page.getByTestId("filters-panel")).toBeHidden();
  });

  test("karşılaştırma mobilde alt alta açılır", async ({ page }) => {
    await page.goto("/tr?y=1453&mode=compare&y2=1800");
    const a = await page.getByTestId("map-year").boundingBox();
    const b = await page.getByTestId("map-year2").boundingBox();
    expect((b?.y ?? 0)).toBeGreaterThanOrEqual((a?.y ?? 0) + (a?.height ?? 0) - 2);
  });
});
