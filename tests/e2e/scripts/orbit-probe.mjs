import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto("http://localhost:3000/components/orbital-menu");
const item = page.getByTestId("playground-stage").getByRole("menuitem", { name: "Photo" });
const t0 = Date.now();
const rows = [];
for (let i = 0; i < 14; i++) {
  const b = await item.boundingBox();
  const vis = await item.evaluate((el) => {
    const w = el.closest('[data-slot="orbital-menu-ring"] > span');
    return { opacity: getComputedStyle(w).opacity, transform: getComputedStyle(w).transform, translate: getComputedStyle(w).translate, visible: el.checkVisibility() };
  });
  rows.push({ t: Date.now() - t0, x: b && Math.round(b.x), y: b && Math.round(b.y), ...vis });
  await page.waitForTimeout(150);
}
console.log(JSON.stringify(rows));
await browser.close();
