import { expect, test } from "../fixtures";

test.describe("mosaic menu", () => {
  test("opens a modal mosaic, traps focus, navigates with arrows and closes with Escape", async ({ page }) => {
    await page.goto("/components/mosaic-menu");
    await expect(page.getByRole("heading", { level: 1, name: "MosaicRoute Menu" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const stage = page.getByTestId("playground-stage");
    const trigger = stage.getByRole("button", { name: "Menu" });
    await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Site menu" });
    await expect(dialog).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(dialog.getByRole("navigation").getByRole("link")).toHaveCount(6);
    await expect(dialog.getByRole("link", { name: /Studio/ })).toBeFocused(); // current route
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

    // tiles settle at full opacity and the wide tile spans two columns
    const work = dialog.getByRole("link", { name: /Work/ });
    await expect.poll(async () => work.evaluate((el) => getComputedStyle(el.closest("li")!).opacity), { timeout: 3000 }).toBe("1");
    const workBox = (await work.boundingBox())!;
    const journalBox = (await dialog.getByRole("link", { name: /Journal/ }).boundingBox())!;
    expect(workBox.width).toBeGreaterThan(journalBox.width * 1.6);

    // 2D keyboard navigation
    await page.keyboard.press("ArrowRight");
    await expect(dialog.getByRole("link", { name: /Journal/ })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(work).toBeFocused();
    await page.keyboard.press("End");
    await expect(dialog.getByRole("link", { name: /Careers/ })).toBeFocused();

    // focus trap: Tab from the last focusable wraps to the first
    const lastTabbable = dialog.locator("a, button").last();
    await lastTabbable.focus();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Close menu" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });

  test("backdrop click and tile activation close it; playground controls apply", async ({ page }) => {
    await page.goto("/components/mosaic-menu");
    const stage = page.getByTestId("playground-stage");
    await page.getByRole("slider", { name: "Gap" }).fill("20");
    await page.getByLabel("Tiles (demo)").selectOption("plain");
    await expect(page.getByTestId("playground-code")).toContainText("gap={20}");
    await stage.getByRole("button", { name: "Menu" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-slot="mosaic-grid"]')).toHaveCSS("gap", "20px");
    await page.mouse.click(8, 8); // backdrop corner
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // the playground keeps the menu open on navigation (onNavigate returns false)
    await stage.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: /Journal/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByLabel("Reduced motion").check();
    await stage.getByRole("button", { name: "Menu" }).click();
    await expect(page.locator('[data-slot="mosaic-menu-overlay"]')).toHaveAttribute("data-motion", "reduced");
    await page.keyboard.press("Escape");
  });

  test("registry item is served", async ({ request }) => {
    const res = await request.get("/r/mosaic-menu.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain('role="dialog"');
    expect(item.meta.tier).toBe("premium");
  });
});
