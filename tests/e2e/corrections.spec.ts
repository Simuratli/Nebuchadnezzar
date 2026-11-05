import { expect, test, type Page } from "@playwright/test";

const centreName = async (page: Page) => page.getByTestId("map-year").getAttribute("data-correction-at-center");

test.describe("Güney Kafkasya düzeltmesi", () => {
  test("1880'de Kafkasya Rus İmparatorluğu olarak çizilir", async ({ page }) => {
    await page.goto("/tr?y=1880&lat=40.68&lng=45.9&z=6");
    await expect.poll(() => centreName(page), { timeout: 40_000 }).toBe("Rus İmparatorluğu");
    await expect(page.getByText("Güney Kafkasya düzeltildi")).toBeVisible();
  });

  test("yıl antlaşmayı geçince bölge değişir", async ({ page }) => {
    await page.goto("/tr?y=1827&lat=40.05&lng=44.6&z=7");
    await expect.poll(() => centreName(page), { timeout: 40_000 }).toContain("Erivan Hanlığı");
    await page.getByTestId("slider-year").focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => centreName(page), { timeout: 20_000 }).toBe("Rus İmparatorluğu");
  });

  test("dönem dışında katman görünmez", async ({ page }) => {
    await page.goto("/tr?y=1700&lat=40.68&lng=45.9&z=6");
    const map = page.getByTestId("map-year");
    await expect.poll(async () => Number(await map.getAttribute("data-rendered-boundaries")), { timeout: 40_000 }).toBeGreaterThan(0);
    expect(await centreName(page)).toBeFalsy();
    await expect(page.getByText("Güney Kafkasya düzeltildi")).toBeHidden();
  });

  test("tıklanınca uyarı, dönemler ve kaynaklarla panel açılır", async ({ page }) => {
    await page.goto("/tr?y=1880&lat=40.05&lng=44.6&z=7");
    const map = page.getByTestId("map-year");
    await expect.poll(() => centreName(page), { timeout: 40_000 }).toBe("Rus İmparatorluğu");
    const box = await map.boundingBox();
    if (!box) throw new Error("no box");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    await expect(page.getByTestId("correction-title")).toHaveText("Rus İmparatorluğu");
    await expect(page).toHaveURL(/fix=erivan/);
    await expect(page.getByTestId("correction-warning")).toContainText("bugünkü idari sınırlar");
    await expect(page.getByTestId("correction-periods")).toContainText("Erivan Hanlığı");
    await expect(page.getByTestId("source-item").first()).toContainText("Treaty of Turkmenchay");
  });

  test("dönem satırı yılı taşır ve başlığı günceller", async ({ page }) => {
    await page.goto("/tr?y=1880&fix=erivan");
    await page.getByTestId("correction-periods").getByText("Erivan Hanlığı").click();
    await expect(page.getByTestId("year-label-year")).toHaveText("MS 1800");
    await expect(page.getByTestId("correction-title")).toContainText("Erivan Hanlığı");
  });

  test("ihtilaflı alan ihtilaflı olarak gösterilir", async ({ page }) => {
    await page.goto("/tr?y=1919&fix=karabag-zengezur");
    await expect(page.getByTestId("correction-title")).toContainText("İhtilaflı");
  });

  test("indirilen görselin dipnotu düzeltmeyi bildirir, dönem dışında bildirmez", async ({ page }) => {
    await page.goto("/tr?y=1880");
    await page.getByTestId("nav-export").click();
    await expect(page.getByTestId("export-caption")).toContainText("Natural Earth");
    await page.getByTestId("slider-year").focus();
    await page.keyboard.press("End");
    await expect(page.getByTestId("export-caption")).not.toContainText("Natural Earth");
  });
});
