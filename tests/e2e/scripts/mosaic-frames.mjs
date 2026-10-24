/** Dev tool: capture the MosaicMenu opening choreography. node scripts/mosaic-frames.mjs <outDir> */
import { chromium } from "@playwright/test";
const out = process.argv[2] ?? "mosaic";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 });
await page.goto("http://localhost:3000/components/mosaic-menu");
const stage = page.getByTestId("playground-stage");
await page.getByRole("slider", { name: "Stagger" }).fill("0.08");
await page.waitForTimeout(300);
await stage.getByRole("button", { name: "Menu" }).click();
const t0 = Date.now();
for (const t of [80, 200, 360, 600, 1200]) {
  const wait = t - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/open-${String(t).padStart(4, "0")}.png` });
}
await page.keyboard.press("Escape");
await page.waitForTimeout(90);
await page.screenshot({ path: `${out}/close-0090.png` });
await browser.close();
console.log("ok");
