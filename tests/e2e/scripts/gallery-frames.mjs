/** Dev tool: capture the FlowStackGallery thumbnail flight. node scripts/gallery-frames.mjs <outDir> */
import { chromium } from "@playwright/test";
const out = process.argv[2] ?? "gallery";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
await page.goto("http://localhost:3000/components/flow-stack-gallery");
const stage = page.getByTestId("playground-stage");
const gallery = stage.getByRole("group", { name: "Lookbook" });
await page.waitForTimeout(600);
// the page may scroll when a thumbnail is selected, so measure the gallery for every shot
const shot = async (n) => {
  const clip = await gallery.boundingBox();
  await page.screenshot({ path: `${out}/${n}.png`, clip: { x: clip.x - 10, y: clip.y - 10, width: clip.width + 20, height: clip.height + 20 } });
};
await shot("1-rest");
await gallery.getByRole("tab", { name: /Night bus/ }).click();
const t0 = Date.now();
for (const t of [60, 160, 300, 500, 1000]) {
  const wait = t - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  await shot(`2-flight-${String(t).padStart(4, "0")}`);
}
await gallery.getByRole("button", { name: "Next image" }).click();
await page.waitForTimeout(120);
await shot("3-next-0120");
await page.waitForTimeout(600);
await shot("3-next-0720");
await browser.close();
console.log("ok");
