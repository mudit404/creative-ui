import { expect, test } from "../fixtures";

/**
 * Visual regression: static states of the component in both tones and under
 * reduced motion. Idle bursts are disabled and the pointer parked so frames
 * are deterministic. Baselines are per-platform; regenerate with
 * `pnpm --filter e2e test:update` after an intentional change.
 */

test.describe("visual", () => {
  // Baselines are captured on macOS (chromium-darwin). Other platforms have no snapshots yet, and a missing
  // snapshot fails the test, so skip until per-platform baselines are published (DECISIONS 012).
  test.skip(process.platform !== "darwin", "visual baselines exist for chromium-darwin only");

  for (const scheme of ["light", "dark"] as const) {
    test(`component page title block, ${scheme} site theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto("/components/material-button");
      await page.mouse.move(0, 0);
      await page.waitForTimeout(400);
      await expect(page.locator("main header")).toHaveScreenshot(`title-${scheme}.png`);
    });
  }

  test("button states on the stage", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/components/material-button");
    await page.mouse.move(0, 0);
    const stage = page.getByTestId("playground-stage");
    await page.waitForTimeout(400);
    await expect(stage).toHaveScreenshot("stage-ink-rest.png");
    await page.getByLabel("Tone").selectOption("bone");
    await page.getByRole("radio", { name: "Dark" }).click();
    await page.waitForTimeout(400);
    await expect(stage).toHaveScreenshot("stage-bone-dark.png");
    await page.getByLabel("Loading", { exact: true }).check();
    await page.waitForTimeout(300);
    await expect(stage).toHaveScreenshot("stage-bone-loading.png");
  });
});
