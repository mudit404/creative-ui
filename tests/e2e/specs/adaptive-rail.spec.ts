import { expect, test } from "@playwright/test";

test.describe("adaptive rail", () => {
  test("collapses while scrolling down and expands on scroll up or idle", async ({ page }) => {
    await page.goto("/components/adaptive-rail");
    await expect(page.getByRole("heading", { level: 1, name: "Contextual Floating Rail" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const stage = page.getByTestId("playground-stage");
    const rail = stage.getByRole("toolbar", { name: "Actions" });
    const panel = stage.getByTestId("rail-panel");
    await expect(rail).toHaveAttribute("data-state", "expanded");
    await expect(rail.getByRole("button", { name: "Bookmarks" })).toBeVisible();

    // keep scrolling down (like a real flick): collapses to priority items
    await panel.evaluate((el) => {
      (window as unknown as { __scroll: number }).__scroll = window.setInterval(() => (el.scrollTop += 24), 50);
    });
    await expect(rail).toHaveAttribute("data-state", "collapsed");
    await expect(rail.getByRole("button", { name: "Home" })).toBeVisible();
    await expect(rail.getByRole("button", { name: "Bookmarks" })).toHaveCount(0);
    await page.evaluate(() => window.clearInterval((window as unknown as { __scroll: number }).__scroll));

    // idle: expands again
    await expect(rail).toHaveAttribute("data-state", "expanded", { timeout: 2000 });
    await expect(rail.getByRole("button", { name: "Bookmarks" })).toBeVisible();

    // scroll down then up: expands on the way up
    await panel.evaluate((el) => (el.scrollTop = 800));
    await page.waitForTimeout(30);
    await panel.evaluate((el) => (el.scrollTop = 900));
    await expect(rail).toHaveAttribute("data-state", "collapsed");
    await panel.evaluate((el) => (el.scrollTop = 700));
    await expect(rail).toHaveAttribute("data-state", "expanded");
  });

  test("toolbar keyboard navigation and context switching", async ({ page }) => {
    await page.goto("/components/adaptive-rail");
    const stage = page.getByTestId("playground-stage");
    const rail = stage.getByRole("toolbar", { name: "Actions" });
    await rail.getByRole("button", { name: "Home" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(rail.getByRole("button", { name: "Search" })).toBeFocused();
    await page.keyboard.press("End");
    await expect(rail.getByRole("button", { name: "Settings" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(rail.getByRole("button", { name: "Home" })).toBeFocused();

    await page.getByLabel("Context", { exact: true }).selectOption("selection");
    await expect(rail.getByRole("button", { name: "Share" })).toBeVisible();
    await expect(rail.getByRole("button", { name: "Home" })).toHaveCount(0);
    await expect(page.getByTestId("playground-code")).toContainText('context="selection"');

    await page.getByLabel("Placement").selectOption("right");
    await expect(rail).toHaveAttribute("aria-orientation", "vertical");
  });

  test("hide behaviour slides the rail away", async ({ page }) => {
    await page.goto("/components/adaptive-rail");
    const stage = page.getByTestId("playground-stage");
    await page.getByLabel("On scroll down").selectOption("hide");
    const rail = stage.getByRole("toolbar", { name: "Actions" });
    const panel = stage.getByTestId("rail-panel");
    await panel.evaluate((el) => {
      (window as unknown as { __scroll: number }).__scroll = window.setInterval(() => (el.scrollTop += 24), 50);
    });
    await expect(rail).toHaveAttribute("data-state", "hidden");
    await expect(rail).toHaveCSS("opacity", "0", { timeout: 3000 });
    await page.evaluate(() => window.clearInterval((window as unknown as { __scroll: number }).__scroll));
    await expect(rail).toHaveAttribute("data-state", "expanded", { timeout: 2000 });
  });

  test("registry item is served", async ({ request }) => {
    const res = await request.get("/r/adaptive-rail.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain('role="toolbar"');
    expect(item.registryDependencies.some((d: string) => d.endsWith("/use-scroll-direction.json"))).toBe(true);
  });
});
