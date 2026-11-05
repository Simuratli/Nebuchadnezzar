import { expect, test, type Page } from "@playwright/test";
import events from "../../data/seed/events.json";

const idByEnglishTitle = (title: string) => {
  const e = events.find((x) => (x.i18n as Record<string, { title?: string }>).en?.title === title);
  if (!e) throw new Error(`no event titled ${title}`);
  return e.id;
};

const openEvent = async (page: Page, locale: string, title: string) => {
  await page.goto(`/${locale}?y=1500&e=${idByEnglishTitle(title)}`);
  await expect(page.getByTestId("event-facts")).toBeVisible();
};

test.describe("olay kartı", () => {
  test("savaşta iki taraf, komutan ve sonuç aynı düzende görünür", async ({ page }) => {
    await openEvent(page, "en", "Battle of Chaldiran");
    const sides = page.getByTestId("fact-side");
    await expect(sides).toHaveCount(2);
    await expect(sides.first()).toContainText("Ottoman");
    await expect(sides.nth(1)).toContainText("Safavid");
    await expect(sides.first()).toContainText("Selim");
    await expect(page.getByTestId("fact-result")).toContainText(/Ottoman/);
    await expect(page.getByTestId("fact-place")).toBeVisible();
  });

  test("kart seçili dilde görünür, sonuç İngilizce kalır", async ({ page }) => {
    await openEvent(page, "tr", "Battle of Chaldiran");
    await expect(page.getByTestId("event-facts")).toContainText("Olay özeti");
    await expect(page.getByTestId("fact-side").first()).toContainText("Osmanlı");
    await openEvent(page, "az", "Battle of Chaldiran");
    await expect(page.getByTestId("event-facts")).toContainText("Hadisə xülasəsi");
  });

  test("antlaşmada imzacılar görünür, maddeler bulunmadığı açıkça söylenir", async ({ page }) => {
    await openEvent(page, "en", "Treaty of Turkmenchay");
    await expect(page.getByTestId("fact-signatories")).toContainText("Russian Empire");
    await expect(page.getByTestId("event-facts")).toContainText("Treaty articles are not included");
  });

  test("komutan kişi sayfasına bağlanır", async ({ page }) => {
    await openEvent(page, "en", "Battle of Manzikert");
    await page.getByTestId("fact-person").first().click();
    await expect(page.getByTestId("person-panel")).toBeVisible();
    await expect(page.getByTestId("event-panel")).toBeHidden();
  });

  test("kartı olmayan olayda kart çıkmaz", async ({ page }) => {
    // A city founding has no parties or result.
    const founding = events.find((e) => e.category === "kurulus");
    await page.goto(`/en?y=1500&e=${founding?.id}`);
    await expect(page.getByTestId("event-panel")).toBeVisible();
    await expect(page.getByTestId("event-title")).toBeVisible();
    await expect(page.getByTestId("event-facts")).toBeHidden();
  });
});

test.describe("devletler çizelgesi", () => {
  const row = (page: Page, id: string) => page.locator(`[data-state="${id}"]`);

  test.beforeEach(async ({ page }) => {
    await page.goto("/en?y=1505");
    await page.getByTestId("nav-states").click();
    await expect(page.getByTestId("states-chart")).toBeVisible();
  });

  test("seçili yılda var olan devletleri işaretler: Osmanlı, Safevî, Timurlu", async ({ page }) => {
    for (const id of ["osmanli", "safevi", "timurlu"]) await expect(row(page, id)).toHaveAttribute("data-active", "true");
    await expect(row(page, "abbasi")).toHaveAttribute("data-active", "false");
    await expect(page.getByTestId("states-count")).toContainText("1505 CE");
  });

  test("şeritler eksene göre doğru yerde ve doğru oranda", async ({ page }) => {
    const bar = async (id: string) => row(page, id).getByTestId("state-bar").boundingBox();
    const ottoman = await bar("osmanli");
    const safavid = await bar("safevi");
    expect(ottoman && safavid).toBeTruthy();
    expect(ottoman?.x ?? 0).toBeLessThan(safavid?.x ?? 0);
    // 623 years against 235.
    expect((ottoman?.width ?? 0) / (safavid?.width ?? 1)).toBeGreaterThan(2.4);
    expect((ottoman?.width ?? 0) / (safavid?.width ?? 1)).toBeLessThan(2.9);
  });

  test("kaydırıcı değişince işaretler güncellenir", async ({ page }) => {
    await expect(row(page, "safevi")).toHaveAttribute("data-active", "true");
    await page.getByTestId("slider-year").focus();
    await page.keyboard.press("End");
    await expect(row(page, "safevi")).toHaveAttribute("data-active", "false");
    await expect(row(page, "turkiye")).toHaveAttribute("data-active", "true");
  });

  test("satıra tıklamak ayrıntı gösterir, devlet yoksa yılı ona taşır", async ({ page }) => {
    await row(page, "safevi").click();
    await expect(page.getByTestId("states-detail")).toContainText("1501 CE – 1736 CE");
    await expect(page.getByTestId("year-label-year")).toHaveText("1505 CE");
    await row(page, "abbasi").click();
    await expect(page.getByTestId("year-label-year")).toHaveText("750 CE");
    await expect(page.getByTestId("states-detail").getByRole("link")).toHaveAttribute("href", /wikipedia/);
  });

  test("klavyeyle gezilir ve erişilebilir adı vardır", async ({ page }) => {
    await expect(row(page, "osmanli")).toHaveAttribute("aria-label", /1299 CE – 1922 CE/);
    await row(page, "osmanli").focus();
    await expect(page.getByTestId("states-detail")).toContainText("1299 CE");
  });

  test("elle tarihlenen devlet bunu belirtir, devam eden devlet günümüze uzanır", async ({ page }) => {
    await row(page, "zend").click();
    await expect(page.getByTestId("states-detail")).toContainText("Date entered by hand");
    await row(page, "turkiye").focus();
    await expect(page.getByTestId("states-detail")).toContainText("1923 CE – present");
  });

  test("kapatılır", async ({ page }) => {
    await page.getByTestId("states-close").click();
    await expect(page.getByTestId("states-chart")).toBeHidden();
  });

  test("Türkçe ve Azerbaycanca çalışır", async ({ page }) => {
    await page.goto("/tr?y=1505");
    await page.getByTestId("nav-states").click();
    await expect(row(page, "safevi")).toContainText("Safev");
    await expect(page.getByTestId("states-chart")).toContainText("Kafkasya");
    await page.goto("/az?y=1505");
    await page.getByTestId("nav-states").click();
    await expect(row(page, "safevi")).toContainText("Səfəvi");
    await expect(page.getByTestId("states-chart")).toContainText("Qafqaz");
  });
});
