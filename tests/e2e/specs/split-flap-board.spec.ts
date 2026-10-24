import { expect, test } from "@playwright/test";

test.describe("split flap board", () => {
  test("only changed digits flip, interruptions re-route to the newest value, NaN shows the placeholder", async ({ page }) => {
    await page.goto("/components/split-flap-board");
    await expect(page.getByRole("heading", { level: 1, name: "Split Flap Board" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const ex = page.getByTestId("example-counter");
    const root = ex.locator('[data-slot="split-flap-board"]');
    const text = root.locator(".sr-only");
    await expect(text).toHaveText(/1234/);
    await expect(root).toHaveAttribute("data-state", "settled");
    await ex.getByRole("button", { name: "+137", exact: true }).click();
    await expect(text).toHaveText(/1371/); // the accessible value changes immediately
    await expect(root).toHaveAttribute("data-state", "flipping");
    await expect(root).toHaveAttribute("data-state", "settled", { timeout: 5000 });
    await expect(ex.getByRole("list", { name: "Event log" })).toContainText("onSettled(");
    const faces = await root.locator("[data-cell]").count();
    expect(faces).toBe(6);
    await ex.getByRole("button", { name: /interrupt/ }).click();
    await expect(text).toHaveText(/2376/);
    await expect(root).toHaveAttribute("data-state", "settled", { timeout: 5000 });
    await expect(ex.getByRole("list", { name: "Event log" }).locator("li").first()).toContainText("2376");
    await ex.getByRole("button", { name: "NaN" }).click();
    await expect(text).toHaveText(/—/);
    await expect(root).toHaveAttribute("data-state", "settled", { timeout: 3000 });
  });

  test("shaped scripts fall back to whole-content mode; paused boards still update their text", async ({ page }) => {
    await page.goto("/components/split-flap-board");
    const scripts = page.getByTestId("example-scripts");
    await scripts.scrollIntoViewIfNeeded();
    const root = scripts.locator('[data-slot="split-flap-board"]');
    await expect(root).toHaveAttribute("data-variant", "characters");
    await scripts.getByRole("button", { name: "Next language" }).click();
    await expect(root.locator(".sr-only")).toHaveText("مرحبا");
    await expect(root).toHaveAttribute("data-variant", "whole");
    await scripts.getByRole("button", { name: "Next language" }).click();
    await expect(root.locator(".sr-only")).toHaveText("स्वागत है");
    await expect(root).toHaveAttribute("data-variant", "whole");

    const dep = page.getByTestId("example-departures");
    await dep.scrollIntoViewIfNeeded();
    await dep.getByLabel(/Pause flaps/).check();
    const status = dep.locator('[data-slot="split-flap-board"][aria-label="LONDON status"], [data-slot="split-flap-board"]').filter({ has: page.locator('[aria-label="LONDON status"]') }).first();
    const before = await status.locator(".sr-only").textContent();
    await expect
      .poll(async () => status.locator(".sr-only").textContent(), { timeout: 8000 })
      .not.toBe(before);
    await expect(status).toHaveAttribute("data-state", "settled");
  });

  test("reduced motion swaps instantly and announces; the playground generates code", async ({ page }) => {
    await page.goto("/components/split-flap-board");
    const red = page.getByTestId("example-reduced");
    await red.scrollIntoViewIfNeeded();
    const root = red.locator('[data-slot="split-flap-board"]');
    await expect(root).toHaveAttribute("data-motion", "reduced");
    await expect(red.getByRole("status")).toHaveText(/READY/);
    await red.getByRole("button", { name: "Toggle" }).click();
    await expect(red.getByRole("status")).toHaveText(/RUNNING/);
    await expect(root).toHaveAttribute("data-state", "settled");

    const stage = page.getByTestId("playground-stage");
    await stage.scrollIntoViewIfNeeded();
    await expect(stage.locator('[data-slot="split-flap-board"]')).toHaveAttribute("data-state", "settled", { timeout: 5000 });
    await expect(page.getByTestId("playground-code")).toContainText('value="BOARDING"');
  });
});
