import { expect, test } from "@playwright/test";

test.describe("orbital menu", () => {
  test("opens into a ring, navigates by keyboard, and closes with Escape", async ({ page }) => {
    await page.goto("/components/orbital-menu");
    await expect(page.getByRole("heading", { level: 1, name: "Orbital Action Menu" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const stage = page.getByTestId("playground-stage");
    const trigger = stage.getByRole("button", { name: "Create" });
    // playground opens initially; close it first
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.getByLabel("Open initially").uncheck();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(stage.getByRole("menu")).toHaveCount(0);

    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const items = stage.getByRole("menuitem");
    await expect(items).toHaveCount(6);
    await expect(items.first()).toBeFocused();

    // items settle on a ring: distances from the trigger centre are equal
    await page.waitForTimeout(900);
    const tb = (await trigger.boundingBox())!;
    const cx = tb.x + tb.width / 2;
    const cy = tb.y + tb.height / 2;
    const dists: number[] = [];
    for (let i = 0; i < 6; i++) {
      const b = (await items.nth(i).boundingBox())!;
      dists.push(Math.hypot(b.x + b.width / 2 - cx, b.y + b.height / 2 - cy));
    }
    for (const d of dists) expect(Math.abs(d - 100)).toBeLessThan(8);

    await page.keyboard.press("ArrowRight");
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press("End");
    await expect(items.nth(5)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(items.first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(stage.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("selecting an item reports it and the playground reshapes the ring", async ({ page }) => {
    await page.goto("/components/orbital-menu");
    const stage = page.getByTestId("playground-stage");
    await stage.getByRole("menuitem", { name: "Photo" }).click();
    await expect(stage.getByText("Selected: Photo")).toBeVisible();
    await expect(stage.getByRole("menu")).toBeAttached(); // closeOnSelect is off in the playground (the ring box is zero-size)

    await page.getByRole("slider", { name: "Items" }).fill("3");
    await expect(stage.getByRole("menuitem")).toHaveCount(3);
    await page.getByRole("slider", { name: "Sweep" }).fill("90");
    await expect(page.getByTestId("playground-code")).toContainText("sweep={90}");
    await page.getByLabel("Show labels").check();
    await expect(stage.getByText("Note", { exact: true })).toBeVisible();
    await page.getByLabel("Reduced motion").check();
    await expect(stage.locator('[data-slot="orbital-menu"]')).toHaveAttribute("data-motion", "reduced");
  });

  test("outside click closes and the custom trigger works", async ({ page }) => {
    await page.goto("/components/orbital-menu");
    const ex = page.getByTestId("example-half");
    await ex.scrollIntoViewIfNeeded();
    const trigger = ex.getByRole("button", { name: "Share to…" });
    await expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    await trigger.click();
    await expect(ex.getByRole("menuitem")).toHaveCount(5);
    await page.mouse.click(10, 300);
    await expect(ex.getByRole("menu")).toHaveCount(0);
  });

  test("registry item is served", async ({ request }) => {
    const res = await request.get("/r/orbital-menu.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain('role="menu"');
    expect(item.meta.tier).toBe("premium");
  });
});
