import { readdirSync } from "node:fs";
import { join } from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "../fixtures";

/**
 * WCAG AA colour contrast (axe-core `color-contrast`: 4.5:1 for text, 3:1 for large text) on every
 * component page, in both site themes, with the playground and every example switched to the dark
 * surface. See DECISIONS 018: component defaults are `light-dark()` pairs that follow the stage's
 * `color-scheme`, so a dark stage inside the light site (and a light stage inside the dark site)
 * must measure clean too.
 *
 * The stages paint a decorative radial highlight over a solid colour. axe cannot read a colour through
 * a gradient and reports every element on it as "incomplete" (`bgGradient`) instead of measuring it, so
 * the scan flattens `.stage`/`.stage-dark` to their base colours (`#f1efe9` / `#121210`) first. Other
 * incomplete reasons (text over images, overlapping layers, single glyphs, gradients a component paints
 * itself such as the MaterialButton face) are counted, not asserted.
 */

// Playwright transpiles specs to CommonJS (no "type": "module" here), so __dirname rather than import.meta.
const slugs = readdirSync(join(__dirname, "../../../apps/docs/src/content/components"), {
  withFileTypes: true,
})
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

interface Hit {
  target: string;
  fg?: string;
  bg?: string;
  ratio?: number;
  expected?: string;
  html: string;
}

async function contrastViolations(
  page: Page,
  include?: string,
): Promise<{ violations: Hit[]; incomplete: Record<string, number> }> {
  let builder = new AxeBuilder({ page }).withRules(["color-contrast"]);
  if (include) builder = builder.include(include);
  const result = await builder.analyze();
  const violations: Hit[] = [];
  for (const v of result.violations) {
    for (const n of v.nodes) {
      const d = (n.any[0]?.data ?? {}) as {
        fgColor?: string;
        bgColor?: string;
        contrastRatio?: number;
        expectedContrastRatio?: string;
      };
      violations.push({
        target: n.target.join(" "),
        fg: d.fgColor,
        bg: d.bgColor,
        ratio: d.contrastRatio,
        expected: d.expectedContrastRatio,
        html: n.html.slice(0, 160),
      });
    }
  }
  // axe cannot measure some nodes (text over images, overlapping layers, single glyphs, gradients painted by
  // the component itself); counted per reason for the report, not asserted.
  const incomplete: Record<string, number> = {};
  for (const v of result.incomplete) {
    for (const n of v.nodes) {
      const key = (n.any[0]?.data as { messageKey?: string } | undefined)?.messageKey ?? "other";
      incomplete[key] = (incomplete[key] ?? 0) + 1;
    }
  }
  return { violations, incomplete };
}

function describe(hits: Hit[]): string {
  return hits
    .map(
      (h) =>
        `${h.ratio ?? "?"}:1 (needs ${h.expected ?? "?"}) fg ${h.fg} on ${h.bg} — ${h.target}\n    ${h.html}`,
    )
    .join("\n  ");
}

test.describe("colour contrast (WCAG AA)", () => {
  for (const scheme of ["light", "dark"] as const) {
    test.describe(`${scheme} site theme`, () => {
      for (const slug of slugs) {
        test(`${slug}`, async ({ page }) => {
          test.setTimeout(120_000);
          await page.setViewportSize({ width: 1440, height: 900 });
          await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
          await page.goto(`/components/${slug}`);
          await page.addStyleTag({
            content: ".stage,.stage-dark{background-image:none !important}",
          });
          await page.waitForTimeout(400);

          // the flattening style must have taken effect, otherwise axe silently skips the stage
          const stageLocator = page.locator(".stage, .stage-dark").first();
          await expect(stageLocator).toHaveCSS("background-image", "none");

          // 1. the page as rendered: site chrome, light stages, prose, code
          const whole = await contrastViolations(page);
          expect(
            whole.violations,
            `page-level contrast failures:\n  ${describe(whole.violations)}`,
          ).toEqual([]);

          // 2. the playground on its dark surface
          const darkRadio = page.getByRole("radio", { name: "Dark" });
          if ((await darkRadio.count()) > 0) {
            await darkRadio.click();
            await expect(page.getByTestId("playground-stage")).toHaveAttribute(
              "data-surface",
              "dark",
            );
            await page.waitForTimeout(300);
            const stage = await contrastViolations(page, '[data-testid="playground-stage"]');
            expect(
              stage.violations,
              `playground dark-surface failures:\n  ${describe(stage.violations)}`,
            ).toEqual([]);
          }

          // 3. every example on its dark surface
          const toggles = page.getByTestId("example-surface");
          const count = await toggles.count();
          for (let i = 0; i < count; i++) {
            const toggle = toggles.nth(i);
            await toggle.click();
            await expect(toggle).toHaveAttribute("aria-pressed", "true");
          }
          await page.waitForTimeout(400);
          const examples = await contrastViolations(page, "#examples");
          expect(
            examples.violations,
            `example dark-surface failures:\n  ${describe(examples.violations)}`,
          ).toEqual([]);
        });
      }
    });
  }
});
