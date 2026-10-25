import { expect, test } from "../fixtures";

test.describe("finish configurator", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  test("options select with reasons, the stage repaints, Reset restores the default", async ({ page }) => {
    await page.goto("/components/finish-configurator");
    await expect(page.getByRole("heading", { level: 1, name: "Finish Configurator" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const ex = page.getByTestId("example-chair");
    const root = ex.locator('[data-slot="finish-configurator"]');
    await expect(root).toHaveAttribute("data-state", "ready", { timeout: 15_000 });
    const canvas = ex.locator("canvas");
    const oak = await canvas.screenshot();
    await expect(ex.getByRole("radio", { name: "Steel" })).toHaveAttribute("data-blocked", "true");
    await ex.getByRole("radio", { name: "Steel" }).click();
    await expect(ex.getByRole("status")).toContainText("Steel requires Shell: Walnut or Matte black.");
    await expect(ex.getByRole("radio", { name: "Steel" })).toHaveAttribute("aria-checked", "false");
    await ex.getByRole("radio", { name: "Walnut" }).click();
    await expect(ex.getByRole("list", { name: "Event log" })).toContainText("onSelectionChange(shell=walnut, select)");
    await page.waitForTimeout(400);
    const walnut = await canvas.screenshot();
    expect(Buffer.compare(oak, walnut)).not.toBe(0);
    await ex.getByRole("radio", { name: "Steel" }).click();
    await expect(ex.getByRole("radio", { name: "Steel" })).toHaveAttribute("aria-checked", "true");
    await expect(ex.getByRole("radio", { name: "Matte black" })).toContainText("unavailable");
    await ex.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(ex.getByRole("radio", { name: "Oak" })).toHaveAttribute("aria-checked", "true");
    await expect(ex.getByRole("radio", { name: "Brass" })).toHaveAttribute("aria-checked", "true");
    await expect(ex.locator("[data-summary]")).toContainText("Selected: Shell: Oak · Trim: Brass · Fabric: Linen");
  });

  test("a late slow texture never overwrites the newer finish; a broken texture keeps the last visual", async ({ page }) => {
    await page.goto("/components/finish-configurator");
    const ex = page.getByTestId("example-slow");
    await ex.scrollIntoViewIfNeeded();
    const root = ex.locator('[data-slot="finish-configurator"]');
    await expect(root).toHaveAttribute("data-state", /ready|fallback/, { timeout: 15_000 });
    await ex.getByRole("radio", { name: "Leather (slow)" }).click();
    await expect(root).toHaveAttribute("data-state", "preparing");
    await expect(ex.locator("[data-preparing]")).toContainText("Loading Leather (slow)…");
    await ex.getByRole("radio", { name: "Canvas (slow)" }).click();
    await expect(ex.locator("[data-preparing]")).toContainText("Loading Canvas (slow)…");
    await expect(root).toHaveAttribute("data-state", /ready|fallback/, { timeout: 8000 });
    await expect(ex.locator("[data-selected-name]")).toHaveText("Canvas (slow)");
    await ex.getByRole("radio", { name: "Broken texture" }).click();
    await expect(ex.getByRole("status")).toContainText("Broken texture:", { timeout: 8000 });
    await expect(ex.getByRole("status")).toContainText("The previous finish is still shown.");
  });

  test("two instances differ; the fallback reports accepted option ids and no price", async ({ page }) => {
    await page.goto("/components/finish-configurator");
    const pair = page.getByTestId("example-pair");
    await pair.scrollIntoViewIfNeeded();
    const summaries = pair.locator("[data-summary]");
    await expect(summaries.nth(0)).toContainText("Shell: Walnut · Trim: Steel · Fabric: Velvet");
    await expect(summaries.nth(1)).toContainText("Shell: Oak · Trim: Brass · Fabric: Linen");

    const fb = page.getByTestId("example-fallback");
    await fb.scrollIntoViewIfNeeded();
    await expect(fb.locator('[data-slot="finish-configurator"]')).toHaveAttribute("data-state", "fallback");
    await expect(fb.locator("[data-summary]")).toContainText("CHAIR-OAK-BRASS-LINEN");
    const text = await fb.textContent();
    expect(text).not.toMatch(/\$|price|in stock/i);
    await page.getByLabel("Reduced motion").check();
    await expect(page.getByTestId("playground-stage").locator('[data-slot="finish-configurator"]')).toHaveAttribute("data-motion", "reduced");
  });

  test("registry item is served with its lib dependencies", async ({ request }) => {
    const res = await request.get("/r/finish-configurator.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain("checkCandidate");
    expect(item.registryDependencies.some((d: string) => d.endsWith("/r/finish-options.json"))).toBeTruthy();
    expect(item.dependencies).toContain("three");
  });
});
