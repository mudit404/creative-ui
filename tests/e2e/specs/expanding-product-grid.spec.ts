import { expect, test } from "@playwright/test";

test.describe("expanding product grid", () => {
  test("expands a card to the full row, reflows, and collapses with Escape", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 }); // wide enough for several columns in the stage
    await page.goto("/components/expanding-product-grid");
    await expect(page.getByRole("heading", { level: 1, name: "ProductCard Expand" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const stage = page.getByTestId("playground-stage");
    const list = stage.getByRole("list", { name: "Products" });
    // playground opens "Trail boot" initially
    const boot = list.getByRole("button", { name: "Trail boot" });
    await expect(boot).toHaveAttribute("aria-expanded", "true");
    await expect(list.getByRole("region", { name: "Trail boot" })).toBeVisible();

    const listBox = (await list.boundingBox())!;
    const openCard = list.locator('[data-state="expanded"]');
    await expect.poll(async () => (await openCard.boundingBox())!.width, { timeout: 3000 }).toBeGreaterThan(listBox.width * 0.95);

    // open another: swaps, and the new one spans the row while the old one shrinks
    const jacket = list.getByRole("button", { name: "Field jacket" });
    await jacket.click();
    await expect(jacket).toHaveAttribute("aria-expanded", "true");
    await expect(boot).toHaveAttribute("aria-expanded", "false");
    await expect(list.getByRole("region")).toHaveCount(1);
    await expect(list.getByRole("button", { name: "Close" })).toBeFocused();
    await expect.poll(async () => (await list.locator('[data-state="expanded"]').boundingBox())!.width, { timeout: 3000 }).toBeGreaterThan(listBox.width * 0.95);
    const collapsedWidth = (await list.locator('[data-state="collapsed"]').first().boundingBox())!.width;
    expect(collapsedWidth).toBeLessThan(listBox.width * 0.6);

    await page.keyboard.press("Escape");
    await expect(jacket).toHaveAttribute("aria-expanded", "false");
    await expect(list.getByRole("region")).toHaveCount(0);
    await expect(jacket).toBeFocused();
  });

  test("playground controls drive the grid and generated code", async ({ page }) => {
    await page.goto("/components/expanding-product-grid");
    const stage = page.getByTestId("playground-stage");
    const list = stage.getByRole("list", { name: "Products" });
    await page.getByLabel("Open initially").selectOption("");
    await expect(list.getByRole("region")).toHaveCount(0);
    await page.getByLabel("Detail layout").selectOption("stack");
    await expect(page.getByTestId("playground-code")).toContainText('detailLayout="stack"');
    await page.getByRole("slider", { name: "Gap" }).fill("8");
    await expect(list).toHaveCSS("gap", "8px");
    await page.getByLabel("Reduced motion").check();
    await expect(list).toHaveAttribute("data-motion", "reduced");
    await list.getByRole("button", { name: "Merino crew" }).click();
    await expect(list.getByRole("region", { name: "Merino crew" })).toBeVisible();
  });

  test("controlled example syncs with external buttons", async ({ page }) => {
    await page.goto("/components/expanding-product-grid");
    const ex = page.getByTestId("example-controlled");
    await ex.scrollIntoViewIfNeeded();
    await ex.getByRole("button", { name: "Open Trail boot" }).click();
    await expect(ex.getByText("?item=p2")).toBeVisible();
    await expect(ex.getByRole("list").getByRole("button", { name: "Trail boot" })).toHaveAttribute("aria-expanded", "true");
    await ex.getByRole("button", { name: "Close" }).click();
    await expect(ex.getByText("?item=none")).toBeVisible();
  });

  test("registry item is served", async ({ request }) => {
    const res = await request.get("/r/expanding-product-grid.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain('role="region"');
    expect(item.meta.tier).toBe("premium");
  });
});
