// Dev helper: node scripts/screenshot.mjs <url> <output.png> [width] [height] [dark]
// Expects a running server. Waits for tiles, reports console errors.
import { chromium } from "@playwright/test";

const [url, out, width = "1400", height = "850", dark] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) }, colorScheme: dark ? "dark" : "light" });
page.on("console", (m) => {
  if (m.type() === "error") console.log("console error:", m.text().slice(0, 300));
});
page.on("pageerror", (e) => console.log("page error:", e.message.slice(0, 300)));
await page.goto(url);
await page.waitForTimeout(9000);
await page.screenshot({ path: out });
await browser.close();
console.log("saved", out);
