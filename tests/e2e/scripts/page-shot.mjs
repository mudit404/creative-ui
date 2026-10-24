/** Dev tool: full-page screenshot of a docs route. node scripts/page-shot.mjs <path> <out.png> [light|dark] */
import { chromium } from "@playwright/test";
const [route = "/", out = "page.png", scheme = "light"] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(`http://localhost:3000${route}`);
await page.waitForTimeout(600);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
