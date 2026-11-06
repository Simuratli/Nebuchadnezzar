import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test.describe("kişisel koleksiyon", () => {
  test("olay ve not eklenir, sayfa yenilense de kalır, çıkarılabilir", async ({ page }) => {
    await page.goto("/tr?y=1453&e=Q160077");
    await page.getByTestId("collection-toggle").click();
    await page.getByTestId("collection-note").fill("Tez için önemli");

    await page.reload();
    await expect(page.getByTestId("collection-note")).toHaveValue("Tez için önemli");

    await page.getByTestId("event-close").click();
    await page.getByTestId("nav-collection").click();
    await expect(page.getByTestId("collection-item")).toHaveCount(1);
    await expect(page.getByTestId("collection-item")).toContainText("Fethi");

    await page.getByTestId("collection-item").getByRole("button", { name: "Koleksiyondan çıkar" }).click();
    await expect(page.getByText("Henüz olay eklemediniz")).toBeVisible();
    await page.reload();
    await page.getByTestId("nav-collection").click();
    await expect(page.getByText("Henüz olay eklemediniz")).toBeVisible();
  });

  test("koleksiyon toplu BibTeX olarak iner", async ({ page }) => {
    await page.goto("/tr?y=1453&e=Q160077");
    await page.getByTestId("collection-toggle").click();
    await page.goto("/tr?y=1071&e=Q200032");
    await page.getByTestId("collection-toggle").click();
    await page.getByTestId("event-close").click();
    await page.getByTestId("nav-collection").click();
    await expect(page.getByTestId("collection-count")).toHaveText("2 olay");

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-bibtex").click()]);
    expect(download.suggestedFilename()).toBe("nebuchadnezzar-koleksiyon.bib");
    const bib = await readFile((await download.path()) as string, "utf8");
    expect(bib).toContain("@misc{Q160077-");
    expect(bib).toContain("@misc{Q200032-");
  });

  test("bozuk tarayıcı verisi uygulamayı düşürmez", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("zaman-atlasi:collection:v1", "{bozuk"));
    await page.goto("/tr");
    await page.getByTestId("nav-collection").click();
    await expect(page.getByText("Henüz olay eklemediniz")).toBeVisible();
  });
});
