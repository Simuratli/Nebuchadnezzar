import { expect, test } from "@playwright/test";

test.describe("kişi sayfaları", () => {
  test("aramadan açılır; yaşam, kaynak ve elle bağlı olay etiketi görünür", async ({ page }) => {
    await page.goto("/tr?y=1000");
    await page.getByTestId("search").fill("kanuni");
    await page.getByTestId("search-result").filter({ hasText: "Kişi" }).first().click();
    await expect(page.getByTestId("person-title")).toContainText("Süleyman");
    await expect(page).toHaveURL(/person=kanuni-sultan-suleyman/);
    await expect(page.getByTestId("person-lived")).toHaveText("MS 1494 – MS 1566");
    await expect(page.getByTestId("person-event").filter({ hasText: "Mohaç" })).toContainText("elle bağlandı");
    await expect(page.getByTestId("person-review")).toBeVisible();
    await expect(page.getByTestId("source-item").first()).toBeVisible();
  });

  test("olaya tıklanınca olay açılır, olaydan kişiye geri dönülür", async ({ page }) => {
    await page.goto("/tr?y=1000&person=fatih-sultan-mehmed");
    await page.getByTestId("person-event").filter({ hasText: "İstanbul'un Fethi" }).click();
    await expect(page.getByTestId("event-title")).toContainText("Fethi");
    await expect(page.getByTestId("year-label-year")).toHaveText("MS 1453");
    await expect(page.getByTestId("person-panel")).toBeHidden();

    await page.getByTestId("event-person").filter({ hasText: "Mehmed" }).click();
    await expect(page.getByTestId("person-title")).toContainText("Mehmed");
    await expect(page.getByTestId("event-panel")).toBeHidden();
  });

  test("dönemine git yılı yaşam ortasına taşır; MÖ kişiler de doğru çalışır", async ({ page }) => {
    await page.goto("/tr?y=1000&person=iskender");
    await expect(page.getByTestId("person-lived")).toHaveText("MÖ 356 – MÖ 323");
    await page.getByTestId("person-go-year").click();
    await expect(page.getByTestId("year-label-year")).toHaveText("MÖ 339");
  });

  test("rotası olan kişi rotaya bağlanır", async ({ page }) => {
    await page.goto("/tr?y=1000");
    await page.getByTestId("search").fill("evliya");
    await page.getByTestId("search-result").first().click();
    await expect(page.getByTestId("person-title")).toContainText("Evliya");
    await expect(page.getByTestId("person-no-events")).toBeVisible();
    await page.getByTestId("person-route").click();
    await expect(page).toHaveURL(/route=evliya-kafkasya/);
    await expect(page.getByTestId("route-waypoints")).toContainText("Erzurum");
  });

  test("rota listesinden kişi sayfası açılır", async ({ page }) => {
    await page.goto("/tr");
    await page.getByTestId("nav-routes").click();
    await page.getByTestId("route-person").first().click();
    await expect(page.getByTestId("person-title")).toContainText("Evliya");
  });

  test("doğum yeri haritayı oraya götürür", async ({ page }) => {
    await page.goto("/tr?y=1500&person=ataturk&lat=40&lng=60&z=3");
    await page.getByTestId("person-birth-place").click();
    await expect.poll(() => Number(new URL(page.url()).searchParams.get("lng")), { timeout: 15_000 }).toBeLessThan(30);
  });

  test("olmayan kişi kimliği yok sayılır", async ({ page }) => {
    await page.goto("/tr?person=yok");
    await expect(page.getByTestId("year-label-year")).toBeVisible();
    await expect(page.getByTestId("person-panel")).toBeHidden();
  });
});
