import { expect, test } from "../fixtures";

test.describe("continuity chart", () => {
  test("rows keep identity across snapshots and bars become dots at the same endpoint", async ({ page }) => {
    await page.goto("/components/continuity-chart");
    await expect(page.getByRole("heading", { level: 1, name: "Continuity Chart" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const stage = page.getByTestId("playground-stage");
    const camera = stage.locator('[data-mark="camera"] [data-bar]');
    const color = await camera.getAttribute("fill");
    const rows = () => stage.locator("[data-row]").evaluateAll((els) => els.map((e) => [e.getAttribute("data-row"), new DOMMatrixReadOnly(getComputedStyle(e).transform).m42] as const).sort((a, b) => a[1] - b[1]).map((r) => r[0]));
    expect((await rows())[0]).toBe("camera"); // 55% leads Q1
    await stage.getByRole("combobox", { name: "Snapshot" }).selectOption("q3");
    await expect(stage.getByRole("status")).toContainText("Transitioning…");
    await expect(stage.getByRole("status")).toContainText("Q3 2026, 12 categories", { timeout: 3000 });
    await expect.poll(rows).toEqual(expect.arrayContaining(["battery", "camera", "privacy"]));
    expect((await rows())[0]).toBe("battery"); // 51 leads Q3
    await expect(camera).toHaveAttribute("fill", color!);
    await expect(stage.locator('[data-mark="software"]')).toHaveCount(0);
    await expect(stage.locator('[data-mark="privacy"]')).toHaveCount(1);

    // geometry via getBBox: Motion may drive SVG size through styles rather than attributes
    const endBefore = await camera.evaluate((r) => {
      const b = (r as SVGGraphicsElement).getBBox();
      return b.x + b.width;
    });
    await stage.getByRole("button", { name: "dots" }).click();
    await expect(stage.locator('[data-slot="continuity-chart"]')).toHaveAttribute("data-mode", "dots");
    await expect.poll(async () => camera.evaluate((r) => Math.round((r as SVGGraphicsElement).getBBox().width)), { timeout: 3000 }).toBe(12);
    const centre = await camera.evaluate((r) => {
      const b = (r as SVGGraphicsElement).getBBox();
      return b.x + b.width / 2;
    });
    expect(Math.abs(centre - endBefore)).toBeLessThan(1);
  });

  test("negatives, nulls, ties and the table; mismatched units fall back to the table", async ({ page }) => {
    await page.goto("/components/continuity-chart");
    const ex = page.getByTestId("example-negative");
    await ex.scrollIntoViewIfNeeded();
    const price = ex.locator('[data-mark="price"] [data-bar]');
    const zero = await ex.locator('[data-mark="storage"] [data-bar]').evaluate((r) => (r as SVGGraphicsElement).getBBox().x);
    await expect.poll(() => price.evaluate((r) => {
      const b = (r as SVGGraphicsElement).getBBox();
      return b.x + b.width;
    }), { timeout: 3000 }).toBeLessThanOrEqual(zero + 0.5);
    await expect(ex.locator('[data-mark="weight"]')).toContainText("Not available");
    await expect(ex.getByRole("button", { name: "Weight: Not available" })).toBeVisible();
    await ex.getByRole("button", { name: "Show table" }).click();
    await expect(ex.getByRole("table")).toBeVisible();
    await expect(ex.getByRole("row", { name: /Weight/ })).toContainText("Not available");

    const units = page.getByTestId("example-units");
    await expect(units.locator('[data-slot="continuity-chart"]')).toHaveAttribute("data-state", "table-only");
    await expect(units.getByRole("note")).toContainText("different units");
    await expect(units.getByRole("table")).toBeVisible();
    await expect(units.getByRole("button", { name: "dots" })).toBeDisabled();
  });

  test("reduced motion updates instantly and the playground drives props", async ({ page }) => {
    await page.goto("/components/continuity-chart");
    const stage = page.getByTestId("playground-stage");
    await page.getByLabel("Reduced motion").check();
    await expect(stage.locator('[data-slot="continuity-chart"]')).toHaveAttribute("data-motion", "reduced");
    await stage.getByRole("combobox", { name: "Snapshot" }).selectOption("q2");
    await expect(stage.getByRole("status")).not.toContainText("Transitioning");
    await expect(stage.getByRole("status")).toContainText("Q2 2026");
    await page.getByLabel("Sort").selectOption("input");
    await expect(page.getByTestId("playground-code")).toContainText('sort="input"');
    const first = await stage.locator("[data-row]").first().getAttribute("data-row");
    expect(first).toBe("price");
  });

  test("registry item is served with its lib dependency", async ({ request }) => {
    const res = await request.get("/r/continuity-chart.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain("layoutRows");
    expect(item.registryDependencies.some((d: string) => d.endsWith("/r/chart-layout.json"))).toBeTruthy();
  });
});
