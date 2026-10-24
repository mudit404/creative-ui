import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://localhost:3000/components/flow-stack-gallery");
const stage = page.getByTestId("playground-stage");
const gallery = stage.getByRole("group", { name: "Lookbook" });
const card = gallery.locator('[data-offset="0"]');
await page.waitForTimeout(500);
await page.evaluate(() => {
  const el = document.querySelector('[data-testid="playground-stage"] [data-offset="0"]');
  const log = [];
  window.__log = log;
  for (const t of ["pointerdown", "pointermove", "pointerup", "mousedown", "mouseup"]) el.addEventListener(t, (e) => log.push(`${t}:${e.pointerType ?? ""}`));
});
const box = await card.boundingBox();
console.log("card", box);
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
for (let i = 1; i <= 10; i++) { await page.mouse.move(box.x + box.width / 2 - i * 20, box.y + box.height / 2); await page.waitForTimeout(16); }
const during = await card.evaluate((el) => getComputedStyle(el).transform);
await page.mouse.up();
await page.waitForTimeout(500);
console.log("events", await page.evaluate(() => window.__log.slice(0, 6)), "during", during, "index", await gallery.getAttribute("data-index"));
await browser.close();
