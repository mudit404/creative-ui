import { expect, test } from "@playwright/test";

test.describe("ascii media", () => {
  test("an image converts to a glyph grid; Show original keeps the same element", async ({ page }) => {
    await page.goto("/components/ascii-media");
    await expect(page.getByRole("heading", { level: 1, name: "ASCII Media" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const ex = page.getByTestId("example-image");
    const root = ex.locator('[data-slot="ascii-media"]');
    await expect(root).toHaveAttribute("data-state", "ascii", { timeout: 10_000 });
    await expect(root).toHaveAttribute("data-showing", "ascii");
    await expect(ex.getByRole("status")).toContainText(/\d+×\d+ cells/);
    const cols = Number(await root.getAttribute("data-cols"));
    const rows = Number(await root.getAttribute("data-rows"));
    expect(cols).toBeGreaterThan(40);
    expect(rows).toBeGreaterThan(10);
    // the canvas carries pixels; the grid is not DOM
    const painted = await ex.locator("canvas[data-glyphs]").evaluate((c: HTMLCanvasElement) => {
      const ctx = c.getContext("2d")!;
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let lit = 0;
      for (let i = 0; i < d.length; i += 4 * 97) if (d[i]! > 128) lit++;
      return lit;
    });
    expect(painted).toBeGreaterThan(0);
    expect(await root.locator("span").count()).toBeLessThan(10); // no per-glyph DOM
    const img = ex.getByRole("img", { name: /lighthouse/ });
    await ex.getByRole("button", { name: "Show original" }).click();
    await expect(root).toHaveAttribute("data-showing", "original");
    await expect(img).toBeVisible();
    await expect(ex.getByRole("button", { name: "Show ASCII" })).toHaveAttribute("aria-pressed", "true");
  });

  test("video glyphs follow playback and stop when paused; the toggle never resets the timeline", async ({ page }) => {
    await page.goto("/components/ascii-media");
    const ex = page.getByTestId("example-video");
    await ex.scrollIntoViewIfNeeded();
    const root = ex.locator('[data-slot="ascii-media"]');
    await expect(root).toHaveAttribute("data-state", "ascii", { timeout: 15_000 });
    const video = ex.locator("video");
    const snapshot = () => ex.locator("canvas[data-glyphs]").evaluate((c: HTMLCanvasElement) => c.toDataURL().length + ":" + c.toDataURL().slice(-64));
    const before = await snapshot();
    await video.evaluate((v: HTMLVideoElement) => v.play());
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 10_000 }).toBeGreaterThan(1);
    await expect.poll(snapshot, { timeout: 10_000 }).not.toBe(before);
    await video.evaluate((v: HTMLVideoElement) => v.pause());
    await page.waitForTimeout(300);
    const paused = await snapshot();
    await page.waitForTimeout(600);
    expect(await snapshot()).toBe(paused);
    const t = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    await ex.getByRole("button", { name: "Show original" }).click();
    await expect(root).toHaveAttribute("data-showing", "original");
    expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeCloseTo(t, 2);
    await expect(video).toHaveAttribute("controls", "");
  });

  test("tainted reads, invalid ramps and reduced motion fall back with reasons; the playground generates code", async ({ page }) => {
    await page.goto("/components/ascii-media");
    const tainted = page.getByTestId("example-tainted");
    await tainted.scrollIntoViewIfNeeded();
    await expect(tainted.locator('[data-slot="ascii-media"]')).toHaveAttribute("data-state", "error", { timeout: 10_000 });
    await expect(tainted.getByRole("status")).toContainText("cross-origin");
    await expect(tainted.getByRole("list", { name: "Event log" })).toContainText("onError(origin)");
    await expect(tainted.getByRole("img", { name: /lighthouse/ })).toBeVisible();

    const ramp = page.getByTestId("example-ramp");
    await ramp.scrollIntoViewIfNeeded();
    const invalid = ramp.locator('[data-slot="ascii-media"][aria-label="Invalid ramp"]');
    await expect(invalid).toHaveAttribute("data-state", "ascii", { timeout: 10_000 });
    await expect(invalid.getByRole("status")).toContainText("using the default ramp");
    const reduced = ramp.locator('[data-slot="ascii-media"][aria-label="Reduced motion video"]');
    await expect(reduced).toHaveAttribute("data-showing", "original");
    await expect(reduced.getByRole("status")).toContainText("Reduced motion");
    await expect(reduced.locator("video")).toHaveAttribute("controls", "");

    const stage = page.getByTestId("playground-stage");
    await stage.scrollIntoViewIfNeeded();
    await expect(stage.locator('[data-slot="ascii-media"]')).toHaveAttribute("data-state", "ascii", { timeout: 10_000 });
    await expect(page.getByTestId("playground-code")).toContainText("columns={72}");
  });
});
