import { test as base, expect, type Locator } from "@playwright/test";

export type { Locator, Page } from "@playwright/test";
export { expect };

/**
 * `test` from here instead of `@playwright/test`: `page.goto` additionally waits
 * for the docs app's hydration marker (`<html data-hydrated="true">`, set by
 * `HydrationMarker` once the page segment has hydrated). Playwright's `load`
 * event fires before React has hydrated the page, and a value filled into a
 * not-yet-hydrated controlled input becomes React's change baseline, so the
 * change handler never runs; the same window loses key presses and drags.
 * Assertions that only read the server-rendered DOM pass either way, which is
 * why this only ever showed on CI. Only `page.goto` is wrapped: reload, history
 * navigation and extra pages would need the same wait.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);
    page.goto = (async (url, options) => {
      const response = await goto(url, options);
      await page
        .locator('html[data-hydrated="true"]')
        .waitFor({ state: "attached", timeout: 30_000 })
        .catch((e: unknown) => {
          throw new Error(
            `The page at ${url} never reported hydration (html[data-hydrated]); interactions would be lost.`,
            { cause: e },
          );
        });
      return response;
    }) as typeof page.goto;
    await use(page);
  },
});

/**
 * Bounding box of an element once two consecutive reads agree, for elements
 * that move into place after mount (measured layouts, transitions). A single
 * `boundingBox()` read right after navigation can land mid-transition.
 */
export async function stableBox(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  let prev = await locator.boundingBox();
  await expect
    .poll(
      async () => {
        const next = await locator.boundingBox();
        const same =
          !!prev &&
          !!next &&
          (["x", "y", "width", "height"] as const).every((k) => Math.abs(next[k] - prev![k]) < 0.5);
        prev = next;
        return same;
      },
      { intervals: [120, 200, 300, 500], timeout: 5000 },
    )
    .toBe(true);
  return prev!;
}
