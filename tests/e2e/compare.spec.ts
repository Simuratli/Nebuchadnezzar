import { expect, test } from "@playwright/test";

test.describe("karşılaştırma modu", () => {
  test("iki harita iki farklı yılı gösterir ve URL'de tutulur", async ({ page }) => {
    await page.goto("/tr?y=1453");
    await page.getByTestId("nav-compare").click();
    await expect(page.getByTestId("map-year2")).toBeVisible();
    await expect(page.getByTestId("map-year")).toHaveAttribute("data-boundary-year", "1400");
    await expect(page.getByTestId("map-year2")).toHaveAttribute("data-boundary-year", "1800");
    await expect(page).toHaveURL(/mode=compare/);
    await expect(page).toHaveURL(/y2=1800/);
  });

  test("sağ yıl kaydırıcısı yalnızca sağ haritayı değiştirir", async ({ page }) => {
    await page.goto("/tr?y=1453&mode=compare&y2=1800");
    const right = page.getByTestId("slider-year2");
    await right.focus();
    await page.keyboard.press("End");
    await expect(page.getByTestId("map-year2")).toHaveAttribute("data-boundary-year", "1945");
    await expect(page.getByTestId("map-year")).toHaveAttribute("data-boundary-year", "1400");
  });

  test("haritalar birlikte kayar ve yakınlaşır, iki yönde de", async ({ page }) => {
    await page.goto("/tr?y=1453&mode=compare&y2=1800&lat=40&lng=40&z=4");
    const left = page.getByTestId("map-year");
    const right = page.getByTestId("map-year2");
    await expect(left.locator("canvas")).toBeVisible();
    await expect(right.locator("canvas")).toBeVisible();

    const drag = async (id: "map-year" | "map-year2", dx: number) => {
      const box = await page.getByTestId(id).boundingBox();
      if (!box) throw new Error("no box");
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y, { steps: 6 });
      await page.mouse.up();
    };
    const center = async (id: "map-year" | "map-year2") => Number((await page.getByTestId(id).getAttribute("data-center"))?.split(",")[0]);

    await drag("map-year", -150);
    await expect.poll(() => center("map-year"), { timeout: 15_000 }).toBeGreaterThan(41);
    await expect.poll(async () => Math.abs((await center("map-year")) - (await center("map-year2")))).toBeLessThan(0.01);

    const before = await center("map-year");
    await drag("map-year2", 150);
    await expect.poll(() => center("map-year"), { timeout: 15_000 }).toBeLessThan(before);
    await expect.poll(async () => Math.abs((await center("map-year")) - (await center("map-year2")))).toBeLessThan(0.01);
  });

  test("kapatılınca tek haritaya döner ve doğru boyutlanır", async ({ page }) => {
    await page.goto("/tr?y=1453&mode=compare&y2=1800");
    await expect(page.getByTestId("map-year2")).toBeVisible();
    const split = await page.getByTestId("map-year").boundingBox();
    await page.getByTestId("nav-compare").click();
    await expect(page.getByTestId("map-year2")).toBeHidden();
    await expect(page).not.toHaveURL(/mode=compare/);
    await expect.poll(async () => (await page.getByTestId("map-year").boundingBox())?.width ?? 0).toBeGreaterThan((split?.width ?? 0) * 1.5);
    const canvas = await page.getByTestId("map-year").locator("canvas").boundingBox();
    const container = await page.getByTestId("map-year").boundingBox();
    expect(Math.abs((canvas?.width ?? 0) - (container?.width ?? 0))).toBeLessThan(2);
  });
});
