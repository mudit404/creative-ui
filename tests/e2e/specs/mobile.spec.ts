import { expect, test } from "@playwright/test";

/** Touch/coarse pointer behaviour on a phone viewport. */
test("works with touch: no hover strands, press burst, no horizontal overflow", async ({ page }) => {
  await page.goto("/components/material-button");
  // no horizontal scroll on phones
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  const stage = page.getByTestId("playground-stage");
  const btn = stage.getByRole("button", { name: "Let’s collaborate" });
  await btn.scrollIntoViewIfNeeded();
  await expect(btn).toBeVisible();
  const canvas = stage.locator("canvas");
  await expect(canvas).toHaveCount(1);

  const pixels = () =>
    canvas.evaluate((c: HTMLCanvasElement) => {
      const { data } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) n++;
      return n;
    });

  // touch press: a burst of strands appears around the edge
  const box = (await btn.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  });
  await page.waitForTimeout(250);
  const during = await pixels();
  expect(during).toBeGreaterThan(50);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(1500);
  const after = await pixels();
  expect(after).toBeLessThan(during);
});
