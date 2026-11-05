import { expect, test } from "@playwright/test";

test.describe("rotalar", () => {
  test("rota oynatılır, yıl ilerler, çizgi haritaya çizilir ve kapatılır", async ({ page }) => {
    await page.goto("/tr?y=1000");
    await page.getByTestId("nav-routes").click();
    await expect(page.getByTestId("route-item")).toHaveCount(3);
    await page.getByTestId("route-play-ibn-battuta-delhi").click();

    await expect(page.getByTestId("route-waypoints")).toContainText("Tanca");
    await expect(page).toHaveURL(/route=ibn-battuta-delhi/);
    await expect(page.getByTestId("year-label-year")).toContainText("MS 13");

    const map = page.getByTestId("map-year");
    await expect.poll(async () => Number(await map.getAttribute("data-route-progress")), { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
    await expect(page.getByTestId("year-label-year")).toHaveText("MS 1334");
    await expect.poll(async () => Number(await map.getAttribute("data-rendered-route")), { timeout: 20_000 }).toBeGreaterThan(0);

    await page.getByTestId("route-stop").click();
    await expect(page).not.toHaveURL(/route=/);
    await expect(map).not.toHaveAttribute("data-route-progress", /.*/);
  });

  test("hareket azaltma tercihinde rota anında tamamlanır", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/tr?y=1000&route=marco-polo-dogu");
    await expect(page.getByTestId("map-year")).toHaveAttribute("data-route-progress", "1.00");
    await expect(page.getByTestId("year-label-year")).toHaveText("MS 1275");
    await context.close();
  });

  test("rotalar gözden geçirme uyarısı taşır", async ({ page }) => {
    await page.goto("/tr");
    await page.getByTestId("nav-routes").click();
    await expect(page.getByTestId("route-item").first()).toContainText("uzman kontrolü");
  });

});

test.describe("turlar", () => {
  test("tur adım adım ilerler, yıl ve harita değişir, bitince kapanır", async ({ page }) => {
    await page.goto("/tr");
    await page.getByTestId("nav-tours").click();
    await page.getByTestId("tour-start-ipek-yolu-yukselisi").click();

    const player = page.getByTestId("tour-player");
    await expect(player).toContainText("uzman kontrolü");
    await expect(page.getByTestId("tour-progress")).toHaveText("Adım 1 / 8");
    await expect(page.getByTestId("year-label-year")).toHaveText("MÖ 500");
    await expect(page.getByTestId("tour-prev")).toBeDisabled();

    await page.getByTestId("tour-next").click();
    await expect(page.getByTestId("tour-progress")).toHaveText("Adım 2 / 8");
    await expect(page.getByTestId("year-label-year")).toHaveText("MÖ 329");
    await expect.poll(() => Number(new URL(page.url()).searchParams.get("lng")), { timeout: 15_000 }).toBeGreaterThan(60);

    await page.getByTestId("tour-event").click();
    await expect(page.getByTestId("event-title")).toContainText("Gaugamela");
    await page.getByTestId("event-close").click();

    await page.getByTestId("tour-prev").click();
    await expect(page.getByTestId("tour-progress")).toHaveText("Adım 1 / 8");

    for (let i = 0; i < 7; i++) await page.getByTestId("tour-next").click();
    await expect(page.getByTestId("tour-next")).toHaveText("Turu bitir");
    await page.getByTestId("tour-next").click();
    await expect(player).toBeHidden();
    await expect(page).not.toHaveURL(/tour=/);
  });

  test("paylaşılan tur bağlantısı turu açar", async ({ page }) => {
    await page.goto("/tr?tour=ipek-yolu-yukselisi");
    await expect(page.getByTestId("tour-step-title")).toHaveText("Pers Kraliyet Yolu");
  });

  test("olmayan tur ve rota kimlikleri yok sayılır", async ({ page }) => {
    await page.goto("/tr?tour=yok&route=yok");
    await expect(page.getByTestId("tour-player")).toBeHidden();
    await expect(page.getByTestId("year-label-year")).toHaveText("MS 1453");
  });
});
