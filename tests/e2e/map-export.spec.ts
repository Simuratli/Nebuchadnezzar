import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

/** Decodes the file in the browser and returns its size and how varied the map area is. */
async function inspectPng(page: Page, file: string) {
  const base64 = (await readFile(file)).toString("base64");
  return page.evaluate(async (data) => {
    const blob = await (await fetch(`data:image/png;base64,${data}`)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no ctx");
    ctx.drawImage(bitmap, 0, 0);
    const mapArea = ctx.getImageData(0, 0, bitmap.width, Math.floor(bitmap.height * 0.6)).data;
    const colours = new Set<number>();
    for (let i = 0; i < mapArea.length; i += 400) colours.add((mapArea[i] << 16) | (mapArea[i + 1] << 8) | mapArea[i + 2]);
    const footerLine = ctx.getImageData(0, bitmap.height - 4, bitmap.width, 1).data;
    return { width: bitmap.width, height: bitmap.height, colours: colours.size, footerWhite: footerLine[0] === 255 };
  }, base64);
}

const ready = async (page: Page, id = "map-year") =>
  expect.poll(async () => Number(await page.getByTestId(id).getAttribute("data-rendered-boundaries")), { timeout: 40_000 }).toBeGreaterThan(5);

test.describe("atıflı harita görseli", () => {
  test("PNG, boş olmayan haritayı ve altında dipnotu içerir", async ({ page }) => {
    await page.goto("/tr?y=1453&lat=40&lng=35&z=4");
    await ready(page);
    const map = await page.getByTestId("map-year").boundingBox();
    await page.getByTestId("nav-export").click();

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-png").click()]);
    expect(download.suggestedFilename()).toBe("zaman-atlasi-1453.png");
    const result = await inspectPng(page, (await download.path()) as string);
    expect(result.colours).toBeGreaterThan(20);
    expect(result.footerWhite).toBe(true);
    expect(result.height).toBeGreaterThan(map?.height ?? 0);
  });

  test("PDF geçerli başlık ve sonla iner", async ({ page }) => {
    await page.goto("/tr?y=-331&lat=36&lng=43&z=4");
    await ready(page);
    await page.getByTestId("nav-export").click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-pdf").click()]);
    expect(download.suggestedFilename()).toBe("zaman-atlasi--331.pdf");
    const bytes = await readFile((await download.path()) as string);
    const text = bytes.toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("/DCTDecode");
    expect(bytes.length).toBeGreaterThan(20_000);
  });

  test("dipnot yılı, sınır haritasını ve atfı doğru gösterir; atıf kopyalanır", async ({ page }) => {
    await page.goto("/tr?y=1453");
    await page.getByTestId("nav-export").click();
    const caption = page.getByTestId("export-caption");
    await expect(caption).toContainText("Zaman Atlası: MS 1453 yılı");
    await expect(caption).toContainText("Sınır haritası: MS 1400");
    await expect(caption).toContainText("OpenStreetMap");

    await page.getByTestId("export-copy").click();
    await expect(page.getByTestId("export-copy")).toHaveText("Kopyalandı");
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain("MS 1453 yılı [Harita]");
    expect(text).toContain("y=1453");
  });

  test("yıl değişince dipnot güncellenir", async ({ page }) => {
    await page.goto("/tr?y=1000");
    await page.getByTestId("nav-export").click();
    await page.getByTestId("slider-year").focus();
    await page.keyboard.press("End");
    await expect(page.getByTestId("export-caption")).toContainText("MS 1950 yılı");
    await expect(page.getByTestId("export-caption")).toContainText("MS 1945");
  });

  test("karşılaştırma modunda iki harita tek görselde birleşir", async ({ page }) => {
    await page.goto("/tr?y=1453&mode=compare&y2=1914&lat=40&lng=35&z=3");
    await ready(page);
    await ready(page, "map-year2");
    const single = await page.getByTestId("map-year").boundingBox();
    await page.getByTestId("nav-export").click();
    await expect(page.getByTestId("export-caption")).toContainText("MS 1453 ve MS 1914 yılları");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-png").click()]);
    expect(download.suggestedFilename()).toBe("zaman-atlasi-1453-1914.png");
    const result = await inspectPng(page, (await download.path()) as string);
    expect(result.width).toBeGreaterThan((single?.width ?? 0) * 1.5);
    expect(result.colours).toBeGreaterThan(20);
  });
});
