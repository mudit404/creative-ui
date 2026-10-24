import { expect, test } from "@playwright/test";

test.describe("cutaway viewer", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  test("clips on WebGL with caps, changes axis and depth without drag, and reports the cut", async ({ page }) => {
    await page.goto("/components/cutaway-viewer");
    await expect(page.getByRole("heading", { level: 1, name: "Cutaway Viewer" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const ex = page.getByTestId("example-layered");
    const root = ex.locator('[data-slot="cutaway-viewer"]');
    await expect(root).toHaveAttribute("data-state", "ready", { timeout: 15_000 });
    await expect(root).toHaveAttribute("data-capped", "true");
    await expect(root).toHaveAttribute("data-enabled", "true");
    const canvas = ex.locator("canvas");
    const cut = await canvas.screenshot();
    await ex.getByRole("checkbox", { name: "Cut enabled" }).uncheck();
    await page.waitForTimeout(400);
    const uncut = await canvas.screenshot();
    expect(Buffer.compare(cut, uncut)).not.toBe(0);
    await ex.getByRole("checkbox", { name: "Cut enabled" }).check();
    await ex.getByRole("button", { name: "X", exact: true }).click();
    await expect(root).toHaveAttribute("data-axis", "x");
    await ex.getByRole("slider", { name: "Depth" }).fill("0.6");
    await expect(root).toHaveAttribute("data-offset", "0.60");
    await expect(ex.locator("[data-cut-readout]")).toContainText("X cut at");
    await ex.getByRole("button", { name: "Keep top" }).click();
    await expect(root).toHaveAttribute("data-axis", "y");
    await expect(root).toHaveAttribute("data-invert", "true");
    await expect(ex.locator("[data-preset-description]")).toContainText("Keeps the upper section");
    const input = ex.getByRole("textbox", { name: "Depth value" });
    await input.fill("-0.75");
    await input.press("Enter");
    await expect(root).toHaveAttribute("data-offset", "-0.75");
    await ex.getByRole("button", { name: "Reset" }).click();
    await expect(root).not.toHaveAttribute("data-enabled");
  });

  test("open and transparent meshes warn instead of faking a cap; the fallback keeps controls explained", async ({ page }) => {
    await page.goto("/components/cutaway-viewer");
    const open = page.getByTestId("example-open");
    await open.scrollIntoViewIfNeeded();
    await expect(open.getByRole("note")).toContainText("cannot be capped", { timeout: 15_000 });
    await expect(open.getByRole("note")).toContainText('"Shell" is not declared closed');

    const glass = page.getByTestId("example-glass");
    await glass.scrollIntoViewIfNeeded();
    await expect(glass.getByRole("note")).toContainText('capMode is "required"', { timeout: 15_000 });
    await expect(glass.getByRole("slider", { name: "Depth" })).toBeDisabled();

    const fb = page.getByTestId("example-fallback");
    await fb.scrollIntoViewIfNeeded();
    await expect(fb.locator('[data-slot="cutaway-viewer"]')).toHaveAttribute("data-state", "fallback");
    await expect(fb.getByRole("img", { name: "A layered box with inner objects" })).toBeVisible();
    await expect(fb.getByText("Interior detail comes from the supplied model.")).toBeVisible();
    await expect(fb.getByRole("slider", { name: "Depth" })).toBeEnabled();
  });

  test("playground and reduced motion", async ({ page }) => {
    await page.goto("/components/cutaway-viewer");
    const stage = page.getByTestId("playground-stage");
    await expect(stage.locator('[data-slot="cutaway-viewer"]')).toHaveAttribute("data-state", /ready|fallback/, { timeout: 15_000 });
    await page.getByLabel("Default axis").selectOption("z");
    await expect(stage.locator('[data-slot="cutaway-viewer"]')).toHaveAttribute("data-axis", "z");
    await expect(page.getByTestId("playground-code")).toContainText('defaultAxis="z"');
    await page.getByLabel("Reduced motion").check();
    await expect(stage.locator('[data-slot="cutaway-viewer"]')).toHaveAttribute("data-motion", "reduced");
  });

  test("registry item is served with its lib dependencies", async ({ request }) => {
    const res = await request.get("/r/cutaway-viewer.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain("planeFor");
    expect(item.registryDependencies.some((d: string) => d.endsWith("/r/clip-plane.json"))).toBeTruthy();
  });
});
