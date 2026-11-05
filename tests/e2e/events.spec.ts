import { expect, test, type Page } from "@playwright/test";
import events from "../../data/seed/events.json";

/** The tests centre the view on a known event, so a click at the middle of the map hits its marker. */
async function openFromMapCentre(page: Page) {
  const box = await page.getByTestId("map-year").boundingBox();
  if (!box) throw new Error("map not visible");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test.describe("olay işaretleri", () => {
  test("yakın görünümde işaret çizilir, tıklayınca panel açılır ve URL güncellenir", async ({ page }) => {
    // Centred on the seed position of a known event, zoomed past the cluster limit.
    const event = events.find((e) => e.id === "Q200032");
    if (event?.geometry.type !== "Point") throw new Error("seed event missing");
    const [lng, lat] = event.geometry.coordinates;
    await page.goto(`/tr?y=1071&lat=${lat}&lng=${lng}&z=9`);
    const map = page.getByTestId("map-year");
    await expect.poll(async () => Number(await map.getAttribute("data-rendered-icons")), { timeout: 40_000 }).toBeGreaterThan(0);
    await openFromMapCentre(page);
    await expect(page.getByTestId("event-panel")).toBeVisible();
    await expect(page.getByTestId("event-title")).toContainText("Malazgirt");
    await expect(page).toHaveURL(/e=Q\d+/);
  });

  test("uzak görünümde olaylar kümelenir", async ({ page }) => {
    await page.goto("/tr?y=1500&lat=40&lng=35&z=3");
    await expect.poll(async () => Number(await page.getByTestId("map-year").getAttribute("data-rendered-clusters")), { timeout: 40_000 }).toBeGreaterThan(0);
  });

  test("küme tıklanınca harita yakınlaşır", async ({ page }) => {
    await page.goto("/tr?y=1500&lat=40&lng=35&z=3");
    const map = page.getByTestId("map-year");
    await expect.poll(async () => Number(await map.getAttribute("data-rendered-clusters")), { timeout: 40_000 }).toBeGreaterThan(0);
    const point = await map.evaluate((el) => el.getAttribute("data-first-cluster"));
    expect(point).toBeTruthy();
    const box = await map.boundingBox();
    const [x, y] = (point as string).split(",").map(Number);
    await page.mouse.click((box?.x ?? 0) + x, (box?.y ?? 0) + y);
    await expect.poll(async () => Number(new URL(page.url()).searchParams.get("z")), { timeout: 15_000 }).toBeGreaterThan(3);
  });

  test("yıl değişince görünen olay sayısı değişir", async ({ page }) => {
    await page.goto("/tr?y=1071");
    const map = page.getByTestId("map-year");
    await page.getByTestId("window").selectOption("0");
    const single = Number(await map.getAttribute("data-visible-events"));
    await page.getByTestId("window").selectOption("100");
    await expect.poll(async () => Number(await map.getAttribute("data-visible-events"))).toBeGreaterThan(single);
  });

  test("paylaşılan olay bağlantısı paneli açar, Esc kapatır", async ({ page }) => {
    await page.goto("/tr?y=1453&e=Q160077");
    await expect(page.getByTestId("event-title")).toContainText("Fethi");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("event-panel")).toBeHidden();
    await expect(page).not.toHaveURL(/e=Q/);
  });

  test("gözden geçirilmemiş kayıt uyarı gösterir", async ({ page }) => {
    // A curated migration line is always flagged.
    await page.goto("/tr?y=1944&e=Q1775286");
    await expect(page.getByTestId("needs-review")).toBeVisible();
  });

  test("olmayan olayda hata ve yeniden deneme gösterilir", async ({ page }) => {
    await page.goto("/tr?y=1453&e=Q999999999");
    await expect(page.getByRole("button", { name: "Yeniden dene" })).toBeVisible();
  });
});
