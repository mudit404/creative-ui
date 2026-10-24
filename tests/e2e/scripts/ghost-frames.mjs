/** Dev tool: capture the GhostTraceText trace at fixed offsets after load. node scripts/ghost-frames.mjs <outDir> */
import { chromium } from "@playwright/test";
const out = process.argv[2] ?? "ghost";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
await page.goto("http://localhost:3000/components/ghost-trace-text", { waitUntil: "domcontentloaded" });
const stage = page.getByTestId("playground-stage");
await stage.getByRole("heading").waitFor();
const t0 = Date.now();
const clip = await stage.boundingBox();
for (const t of [150, 400, 700, 1000, 1300, 1900]) {
  const wait = t - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${String(t).padStart(4, "0")}.png`, clip: { x: clip.x, y: clip.y + 40, width: clip.width, height: 360 } });
}
await browser.close();
console.log("ok");
