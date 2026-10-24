import { expect, test } from "../fixtures";

test.describe("exploded product", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  test("renders the model on WebGL, explodes by button and slider, selects from the list", async ({ page }) => {
    await page.goto("/components/exploded-product");
    await expect(page.getByRole("heading", { level: 1, name: "Exploded Product" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const ex = page.getByTestId("example-speaker");
    const root = ex.locator('[data-slot="exploded-product"]');
    await expect(root).toHaveAttribute("data-state", "ready", { timeout: 15_000 });
    const canvas = ex.locator("canvas");
    await expect(canvas).toBeVisible();
    const before = await canvas.screenshot();
    await ex.getByRole("button", { name: "Explode" }).click();
    await expect(root).toHaveAttribute("data-progress", "1.00");
    await page.waitForTimeout(900);
    const after = await canvas.screenshot();
    expect(Buffer.compare(before, after)).not.toBe(0);
    await ex.getByRole("slider", { name: "Assembly" }).fill("0.5");
    await expect(root).toHaveAttribute("data-progress", "0.50");
    await ex.getByRole("button", { name: "Woofer" }).click();
    await expect(ex.locator("[data-details]")).toContainText("4-inch paper cone.");
    await expect(ex.getByRole("button", { name: "Woofer" })).toHaveAttribute("aria-pressed", "true");
    await ex.getByRole("button", { name: "Top" }).click();
    await ex.getByRole("button", { name: "Reset view" }).click();
  });

  test("missing node maps are diagnosed; two instances stay independent; fallback keeps the list", async ({ page }) => {
    await page.goto("/components/exploded-product");
    const missing = page.getByTestId("example-missing");
    await missing.scrollIntoViewIfNeeded();
    await expect(missing.getByRole("note")).toContainText('Part "ghost": path "Body/Ghost" did not resolve', { timeout: 15_000 });
    await expect(missing.getByRole("note")).toContainText('Part "lid"');
    await expect(missing.getByRole("button", { name: /Ghost panel/ })).toContainText("unmapped");

    const pair = page.getByTestId("example-pair");
    await pair.scrollIntoViewIfNeeded();
    const roots = pair.locator('[data-slot="exploded-product"]');
    await expect(roots.nth(0)).toHaveAttribute("data-progress", "1.00");
    await expect(roots.nth(1)).toHaveAttribute("data-progress", "0.00");

    const fb = page.getByTestId("example-fallback");
    await fb.scrollIntoViewIfNeeded();
    await expect(fb.locator('[data-slot="exploded-product"]')).toHaveAttribute("data-state", "fallback");
    await expect(fb.getByRole("status")).toContainText("3D rendering is unavailable");
    await expect(fb.getByRole("img", { name: "Desk speaker" })).toBeVisible();
    await expect(fb.locator("[data-details]")).toContainText("4-inch paper cone.");
    await fb.getByRole("button", { name: "Explode" }).click();
    await expect(fb.locator('[data-slot="exploded-product"]')).toHaveAttribute("data-progress", "1.00");
  });

  test("playground drives props and reduced motion is reported", async ({ page }) => {
    await page.goto("/components/exploded-product");
    const stage = page.getByTestId("playground-stage");
    await expect(stage.locator('[data-slot="exploded-product"]')).toHaveAttribute("data-state", /ready|fallback/, { timeout: 15_000 });
    await page.getByLabel("Preset").selectOption("Exploded, slow");
    await expect(stage.locator('[data-slot="exploded-product"]')).toHaveAttribute("data-progress", "1.00");
    await expect(page.getByTestId("playground-code")).toContainText("defaultProgress={1}");
    await page.getByLabel("Reduced motion").check();
    await expect(stage.locator('[data-slot="exploded-product"]')).toHaveAttribute("data-motion", "reduced");
  });

  test("registry item isolates its GPU dependency", async ({ request }) => {
    const res = await request.get("/r/exploded-product.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.dependencies).toContain("three");
    expect(item.registryDependencies.some((d: string) => d.endsWith("/r/exploded-parts.json"))).toBeTruthy();
    const capsule = await (await request.get("/r/activity-capsule.json")).json();
    expect(capsule.dependencies).not.toContain("three"); // a lightweight item never pulls Three.js
  });
});
