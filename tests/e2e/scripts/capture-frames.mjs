/**
 * Dev tool: capture frames of a component animation for visual review.
 *   node scripts/capture-frames.mjs <outDir> [baseURL]
 * Captures the LiquidSwitch toggle in the playground at several offsets.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "frames";
const base = process.argv[3] ?? "http://localhost:3000";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
await page.goto(`${base}/components/liquid-switch`);
const stage = page.getByTestId("playground-stage");
await page.getByLabel("Size").selectOption("lg");
await page.getByLabel("Viscosity").fill("0.8");
await page.waitForTimeout(500);
const sw = stage.getByRole("switch");
const box = await sw.boundingBox();
const clip = { x: box.x - 20, y: box.y - 20, width: box.width + 40, height: box.height + 40 };
await page.screenshot({ path: `${out}/0-rest.png`, clip });
await sw.click();
let elapsed = 0;
for (const t of [40, 90, 150, 230, 400, 900]) {
  await page.waitForTimeout(t - elapsed);
  elapsed = t;
  await page.screenshot({ path: `${out}/${String(t).padStart(4, "0")}.png`, clip });
}
await browser.close();
console.log(`wrote frames to ${out}`);
