/** Dev tool: capture the OrbitalMenu launch at fixed offsets. node scripts/orbit-frames.mjs <outDir> */
import { chromium } from "@playwright/test";
const out = process.argv[2] ?? "orbit";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
await page.goto("http://localhost:3000/components/orbital-menu");
const stage = page.getByTestId("playground-stage");
await page.getByLabel("Open initially").uncheck();
await page.getByLabel("Show labels").check();
await page.waitForTimeout(300);
const trigger = stage.getByRole("button", { name: "Create" });
const tb = await trigger.boundingBox();
const clip = { x: tb.x - 170, y: tb.y - 170, width: tb.width + 340, height: tb.height + 340 };
await trigger.click();
const t0 = Date.now();
for (const t of [60, 140, 240, 380, 600, 1000]) {
  const wait = t - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${String(t).padStart(4, "0")}.png`, clip });
}
await browser.close();
console.log("ok");
