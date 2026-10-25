// Discovery sweep: every component page, light + dark site theme, each example toggled to its dark
// surface and the playground dark surface; records axe color-contrast violations per context.
import { chromium } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { readdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const slugs = readdirSync(
  "/Users/mudit/Documents/claude_code_projects/creative-ui/apps/docs/src/content/components",
  { withFileTypes: true },
)
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
const only = process.argv[2] ? [process.argv[2]] : slugs;
const browser = await chromium.launch();
const results = [];
async function scan(page, ctx, selector) {
  let b = new AxeBuilder({ page }).withRules(["color-contrast"]);
  if (selector) b = b.include(selector);
  const r = await b.analyze();
  for (const kind of ["violations", "incomplete"])
    for (const v of r[kind])
      for (const n of v.nodes) {
        const d = n.any[0]?.data ?? {};
        results.push({
          ...ctx,
          kind,
          target: n.target.join(" "),
          fg: d.fgColor,
          bg: d.bgColor,
          ratio: d.contrastRatio,
          expected: d.expectedContrastRatio,
          reason: d.messageKey ?? n.any[0]?.message,
          html: n.html.slice(0, 160),
        });
      }
  return `${r.violations.reduce((a, v) => a + v.nodes.length, 0)}v/${r.incomplete.reduce((a, v) => a + v.nodes.length, 0)}i`;
}
for (const slug of only) {
  for (const scheme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: scheme,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/components/${slug}`, { waitUntil: "load" });
    await page
      .locator('html[data-hydrated="true"]')
      .waitFor({ state: "attached", timeout: 60_000 });
    // The stages paint a decorative radial highlight over a solid colour; axe cannot read a colour through a
    // gradient and reports every element on it as "incomplete" (bgGradient) instead of measuring it. Flatten the
    // stage to its base colour for the scan (#f1efe9 light, #121210 dark), as tests/e2e/specs/contrast.spec.ts does.
    await page.addStyleTag({ content: ".stage,.stage-dark{background-image:none !important}" });
    await page.waitForTimeout(600);
    const n1 = await scan(page, { slug, scheme, surface: "page-default" });
    // dark playground surface
    const darkRadio = page.getByRole("radio", { name: "Dark" });
    let n2 = 0;
    if (await darkRadio.count()) {
      await darkRadio.click();
      await page.waitForTimeout(400);
      n2 = await scan(
        page,
        { slug, scheme, surface: "playground-dark" },
        '[data-testid="playground-stage"]',
      );
    }
    // dark examples
    const toggles = page.locator(
      'article[data-testid^="example-"] [data-testid="example-surface"], article[data-testid^="example-"] > div:first-child button[aria-pressed]',
    );
    const count = await toggles.count();
    for (let i = 0; i < count; i++) await toggles.nth(i).click();
    await page.waitForTimeout(500);
    const n3 = await scan(page, { slug, scheme, surface: "examples-dark" }, "#examples");
    console.log(`${slug} ${scheme}: page ${n1}, playground-dark ${n2}, examples-dark ${n3}`);
    await context.close();
  }
}
await browser.close();
writeFileSync(
  process.env.OUT ??
    "/private/tmp/claude-501/-Users-mudit-Documents-claude-code-projects/f1103256-5450-43db-bb92-b7cd962032aa/scratchpad/axe-results.json",
  JSON.stringify(results, null, 2),
);
console.log("total nodes", results.length);
