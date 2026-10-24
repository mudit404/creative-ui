import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await page.goto("http://localhost:3000/components/ghost-trace-text");
await page.getByLabel("Duration").fill("3");
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Reset" }).click();
const t0 = Date.now();
const samples = [];
for (let i = 0; i < 12; i++) {
  const s = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="playground-stage"] svg text');
    const cs = getComputedStyle(t);
    return { attrOffset: t.getAttribute("stroke-dashoffset"), csOffset: cs.strokeDashoffset, csArray: cs.strokeDasharray, fill: cs.fillOpacity, so: cs.strokeOpacity, state: t.closest("[data-state]").dataset.state };
  });
  samples.push({ t: Date.now() - t0, ...s });
  await page.waitForTimeout(300);
}
console.log(JSON.stringify(samples, null, 0));
await browser.close();
