import { expect, test } from "@playwright/test";

test.describe("compare workbench", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  test("select into the tray, compare, read a semantic table and filter differences", async ({ page }) => {
    await page.goto("/components/compare-workbench");
    await expect(page.getByRole("heading", { level: 1, name: "Compare Workbench" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const stage = page.getByTestId("playground-stage");
    const card = (id: string) => stage.locator(`[data-item="${id}"]`);
    const tray = stage.getByRole("group", { name: "Selected for comparison" });
    await expect(tray).toContainText("2/4 selected");
    await card("c3").getByRole("checkbox", { name: "Compare" }).check();
    await expect(tray).toContainText("3/4 selected");
    await expect(tray.getByText("Gamma Pro")).toBeVisible();
    await expect(stage.getByRole("list", { name: "Event log" })).toContainText("onSelectedIdsChange([c1, c2, c3], select)");

    await stage.getByRole("button", { name: "Compare (3)" }).click();
    const heading = stage.getByRole("heading", { name: "Comparing 3 items" });
    await expect(heading).toBeFocused();
    const table = stage.getByRole("table");
    await expect(table.locator("thead th[scope=col]")).toHaveCount(4);
    await expect(table.locator("tbody th[scope=row]")).toHaveCount(40);
    await expect(table.locator("th[scope=rowgroup]")).toHaveCount(5);
    const weight = table.locator('[data-row="weight"]');
    await expect(weight).toHaveAttribute("data-equality", "incomparable");
    await expect(weight).toContainText("500 g");
    await expect(weight).toContainText("500 oz");
    await expect(table.locator('[data-row="wifi"] td[data-status="unknown"]')).toHaveText("—");
    await expect(table.locator('[data-row="gps"] td[data-status="not-applicable"]')).toHaveText("n/a");

    await stage.getByRole("checkbox", { name: /Differences only/ }).check();
    await expect(table.locator('[data-row="v4k"]')).toHaveCount(0); // all true → hidden
    await expect(weight).toBeVisible(); // incomparable stays
    await expect(table.locator('[data-row="wifi"]')).toBeVisible(); // unknown stays
    await expect(stage.getByText(/\(\d+ equal hidden\)/)).toBeVisible();

    await table.getByRole("button", { name: "Remove Beta Compact from comparison" }).click();
    await expect(table.locator("thead th[scope=col]")).toHaveCount(3);
    await expect(card("c2").getByRole("checkbox", { name: "Compare" })).not.toBeChecked();
  });

  test("limit shows a message and keeps the selection", async ({ page }) => {
    await page.goto("/components/compare-workbench");
    const ex = page.getByTestId("example-limit");
    await ex.locator('[data-item="c4"]').getByRole("checkbox", { name: "Compare" }).click();
    await expect(ex.getByRole("status")).toContainText("You can compare up to 3 items");
    await expect(ex.locator('[data-item="c4"]').getByRole("checkbox")).not.toBeChecked();
    await expect(ex.getByRole("group", { name: "Selected for comparison" })).toContainText("3/3 selected");
  });

  test("data refresh removes a selected item without an orphan column", async ({ page }) => {
    await page.goto("/components/compare-workbench");
    const ex = page.getByTestId("example-refresh");
    await expect(ex.getByRole("table").locator("thead th[scope=col]")).toHaveCount(4);
    await ex.getByRole("button", { name: "Remove Gamma from host data" }).click();
    await expect(ex.getByRole("table").locator("thead th[scope=col]")).toHaveCount(3);
    await expect(ex.getByRole("status")).toContainText("no longer available");
    await expect(ex.getByRole("heading", { name: "Comparing 2 items" })).toBeVisible();
  });

  test("narrow container compares pairs via selectors; reduced motion keeps everything", async ({ page }) => {
    await page.goto("/components/compare-workbench");
    const ex = page.getByTestId("example-narrow");
    await expect(ex.locator('[data-slot="compare-workbench"]')).toHaveAttribute("data-narrow", "true");
    const table = ex.getByRole("table");
    await expect(table.locator("thead th[scope=col]")).toHaveCount(3);
    await ex.getByRole("combobox", { name: "Second item to compare" }).selectOption("c4");
    await expect(table.locator("thead th[scope=col]").nth(2)).toContainText("Delta Cine");

    await page.getByLabel("Reduced motion").check();
    const stage = page.getByTestId("playground-stage");
    await expect(stage.locator('[data-slot="compare-workbench"]')).toHaveAttribute("data-motion", "reduced");
    await stage.locator('[data-item="c4"]').getByRole("checkbox", { name: "Compare" }).check();
    await expect(stage.locator("img.fixed")).toHaveCount(0);
    await stage.getByRole("button", { name: "Compare (3)" }).click();
    await expect(stage.getByRole("heading", { name: "Comparing 3 items" })).toBeFocused();
  });

  test("registry item is served with its lib dependency", async ({ request }) => {
    const res = await request.get("/r/compare-workbench.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain("buildRows");
    expect(item.registryDependencies.some((d: string) => d.endsWith("/r/compare-schema.json"))).toBeTruthy();
  });
});
