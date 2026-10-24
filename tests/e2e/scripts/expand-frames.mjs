/** Dev tool: capture the ExpandingProductGrid expanding a card. node scripts/expand-frames.mjs <outDir> */
import { chromium } from "@playwright/test";
const out = process.argv[2] ?? "expand";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
await page.goto("http://localhost:3000/components/expanding-product-grid");
const stage = page.getByTestId("playground-stage");
await page.getByLabel("Open initially").selectOption("");
await page.waitForTimeout(500);
const clip = await stage.boundingBox();
const shot = (n) => page.screenshot({ path: `${out}/${n}.png`, clip: { ...clip, height: Math.min(clip.height, 560) } });
await shot("1-rest");
await stage.getByRole("button", { name: "Trail boot" }).click();
const t0 = Date.now();
for (const t of [80, 200, 400, 900]) {
  const wait = t - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  await shot(`2-expand-${String(t).padStart(4, "0")}`);
}
await browser.close();
console.log("ok");
