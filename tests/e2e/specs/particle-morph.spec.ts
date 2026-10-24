import { expect, test } from "@playwright/test";

test.describe("particle morph", () => {
  test("targets prepare, morph and complete; the stage changes between emblems", async ({ page }) => {
    await page.goto("/components/particle-morph");
    await expect(page.getByRole("heading", { level: 1, name: "Particle Morph" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const ex = page.getByTestId("example-emblems");
    const root = ex.locator('[data-slot="particle-morph"]');
    await expect(root).toHaveAttribute("data-state", /ready|fallback/, { timeout: 15_000 });
    await expect(root).toHaveAttribute("data-shown", "disc", { timeout: 15_000 });
    const log = ex.getByRole("list", { name: "Event log" });
    await expect(log).toContainText("onMorphComplete(disc, rev 1)");
    const canvas = ex.locator("canvas");
    const disc = await canvas.screenshot();
    await ex.getByRole("button", { name: "Star" }).click();
    await expect(log).toContainText("onTargetRequest(star)");
    await expect(root).toHaveAttribute("data-target", "star");
    await expect(root).toHaveAttribute("data-shown", "star", { timeout: 10_000 });
    await expect(log).toContainText("onMorphComplete(star, rev 2)");
    await expect(ex.locator("[data-label]")).toHaveText("Star");
    await expect(ex.getByRole("button", { name: "Star" })).toHaveAttribute("aria-pressed", "true");
    const star = await canvas.screenshot();
    expect(Buffer.compare(disc, star)).not.toBe(0);
  });

  test("twenty rapid requests complete only the last target; a missing asset keeps label and fallback", async ({ page }) => {
    await page.goto("/components/particle-morph");
    const rapid = page.getByTestId("example-rapid");
    await rapid.scrollIntoViewIfNeeded();
    const root = rapid.locator('[data-slot="particle-morph"]');
    await expect(root).toHaveAttribute("data-shown", "disc", { timeout: 15_000 });
    await rapid.getByRole("button", { name: /Fire 20 requests/ }).click();
    await expect(root).toHaveAttribute("data-shown", "star", { timeout: 10_000 });
    const log = rapid.getByRole("list", { name: "Event log" });
    await expect(log).toContainText("onMorphComplete(star");
    await expect(log).not.toContainText("onMorphComplete(ring");

    const missing = page.getByTestId("example-missing");
    await missing.scrollIntoViewIfNeeded();
    const mroot = missing.locator('[data-slot="particle-morph"]');
    await expect(mroot).toHaveAttribute("data-shown", "disc", { timeout: 15_000 });
    await missing.getByRole("button", { name: "Missing asset" }).click();
    await expect(mroot).toHaveAttribute("data-state", "error", { timeout: 10_000 });
    await expect(missing.getByRole("status")).toContainText(/could not be loaded|failed/i);
    await expect(missing.locator("[data-label]")).toHaveText("Missing asset");
    await expect(missing.getByRole("img", { name: "Missing asset" })).toBeVisible();
    await expect(mroot).toHaveAttribute("data-shown", "disc"); // the last complete emblem stays
    await expect(missing.getByRole("list", { name: "Event log" })).toContainText("onTargetError(missing)");
  });

  test("no renderer keeps the fallback image, label and controls; the playground generates code", async ({ page }) => {
    await page.goto("/components/particle-morph");
    const fb = page.getByTestId("example-fallback");
    await fb.scrollIntoViewIfNeeded();
    const root = fb.locator('[data-slot="particle-morph"]');
    await expect(root).toHaveAttribute("data-state", "fallback", { timeout: 10_000 });
    await expect(fb.getByRole("img", { name: "Disc" })).toBeVisible();
    await fb.getByRole("button", { name: "Ring" }).click();
    await expect(root).toHaveAttribute("data-shown", "ring", { timeout: 10_000 });
    await expect(fb.getByRole("img", { name: "Ring" })).toBeVisible();

    const stage = page.getByTestId("playground-stage");
    await stage.scrollIntoViewIfNeeded();
    await expect(stage.locator('[data-slot="particle-morph"]')).toHaveAttribute("data-shown", "disc", { timeout: 15_000 });
    await expect(page.getByTestId("playground-code")).toContainText("pointCount={8000}");
  });
});
