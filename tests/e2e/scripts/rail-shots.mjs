/** Dev tool: capture the AdaptiveRail playground expanded, collapsed and hidden. node scripts/rail-shots.mjs <outDir> */
import { chromium } from "@playwright/test";
const out = process.argv[2] ?? "rail";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
await page.goto("http://localhost:3000/components/adaptive-rail");
const stage = page.getByTestId("playground-stage");
await page.waitForTimeout(500);
await stage.screenshot({ path: `${out}/1-expanded.png` });
const panel = stage.getByTestId("rail-panel");
for (let i = 1; i <= 4; i++) { await panel.evaluate((el, y) => (el.scrollTop = y), i * 120); await page.waitForTimeout(40); }
await page.waitForTimeout(120);
await stage.screenshot({ path: `${out}/2-collapsed.png` });
await page.getByLabel("Show labels").check();
await page.waitForTimeout(600);
await stage.screenshot({ path: `${out}/3-labels.png` });
await page.getByLabel("Context", { exact: true }).selectOption("selection");
await page.waitForTimeout(600);
await stage.screenshot({ path: `${out}/4-selection.png` });
await browser.close();
console.log("ok");
