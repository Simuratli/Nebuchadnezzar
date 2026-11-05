import { expect, test } from "@playwright/test";

test.describe("atıf kopyalama", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tr?y=1453&e=Q160077");
    await expect(page.getByTestId("source-item").first()).toBeVisible();
  });

  test("her kaynakta rozet ve güvenilirlik görünür", async ({ page }) => {
    const first = page.getByTestId("source-item").first();
    await expect(first).toContainText("Ansiklopedi");
    await expect(first).toContainText("Güvenilirlik: 1/3");
  });

  test("APA, Chicago ve BibTeX panoya doğru metni kopyalar", async ({ page }) => {
    const source = page.getByTestId("source-item").first();

    await source.getByTestId("copy-APA 7").click();
    await expect(source.getByTestId("copy-APA 7")).toHaveText("Kopyalandı");
    const apa = await page.evaluate(() => navigator.clipboard.readText());
    expect(apa).toContain("(t.y.).");
    expect(apa).toContain("adresinden erişildi");

    await source.getByTestId("copy-Chicago").click();
    await expect(source.getByTestId("copy-Chicago")).toHaveText("Kopyalandı");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Erişim ");

    await source.getByTestId("copy-BibTeX").click();
    await expect(source.getByTestId("copy-BibTeX")).toHaveText("Kopyalandı");
    const bibtex = await page.evaluate(() => navigator.clipboard.readText());
    expect(bibtex).toMatch(/^@misc\{Q160077-/);
    expect(bibtex).toContain("url = {https://");
  });
});
