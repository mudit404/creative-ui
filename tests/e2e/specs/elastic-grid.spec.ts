import { expect, test, type Locator } from "../fixtures";

async function columnWidths(list: Locator): Promise<number[]> {
  return list.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").map(parseFloat));
}

test.describe("elastic grid", () => {
  test("stretches the hovered column, settles on leave, and reacts to keyboard focus", async ({ page }) => {
    await page.goto("/components/elastic-grid");
    await expect(page.getByRole("heading", { level: 1, name: "ElasticCatalog" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const stage = page.getByTestId("playground-stage");
    const list = stage.getByRole("list", { name: "Work" });
    await expect(list).toHaveAttribute("data-columns", "4");
    await page.mouse.move(5, 5);
    await page.waitForTimeout(300);
    const rest = await columnWidths(list);
    expect(rest).toHaveLength(4);
    expect(Math.abs(rest[0]! - rest[3]!)).toBeLessThan(2);

    // hover over the last column
    const box = (await list.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.5, { steps: 8 });
    await expect(list).toHaveAttribute("data-active-column", "3");
    await expect.poll(async () => (await columnWidths(list))[3]! / (await columnWidths(list))[0]!, { timeout: 3000 }).toBeGreaterThan(1.2);

    // leave: settles back to equal widths
    await page.mouse.move(5, 5, { steps: 8 });
    await expect(list).not.toHaveAttribute("data-active-column");
    await expect.poll(async () => Math.abs((await columnWidths(list))[3]! - (await columnWidths(list))[0]!), { timeout: 3000 }).toBeLessThan(2);

    // keyboard focus in the second column
    await list.getByRole("link").nth(1).focus();
    await expect(list).toHaveAttribute("data-active-column", "1");
    await expect.poll(async () => (await columnWidths(list))[1]! / (await columnWidths(list))[3]!, { timeout: 3000 }).toBeGreaterThan(1.2);
  });

  test("filtering animates cells and the playground drives the real grid", async ({ page }) => {
    await page.goto("/components/elastic-grid");
    const stage = page.getByTestId("playground-stage");
    const list = stage.getByRole("list", { name: "Work" });
    await expect(list.getByRole("listitem")).toHaveCount(12);
    await page.getByLabel("Filter (demo)").selectOption("film");
    await expect(list.getByRole("listitem")).toHaveCount(4);
    await page.getByRole("slider", { name: "Columns" }).fill("3");
    await expect(list).toHaveAttribute("data-columns", "3");
    await expect(page.getByTestId("playground-code")).toContainText("columns={3}");
    await page.getByLabel("Reduced motion").check();
    await expect(list).toHaveAttribute("data-motion", "reduced");
    await expect(list).toHaveCSS("grid-template-columns", /px/);
  });

  test("the filter example reorders with layout animation", async ({ page }) => {
    await page.goto("/components/elastic-grid");
    const ex = page.getByTestId("example-filter");
    await ex.scrollIntoViewIfNeeded();
    const list = ex.getByRole("list", { name: "Projects" });
    await expect(list.getByRole("listitem")).toHaveCount(12);
    const firstBefore = await list.getByRole("listitem").first().textContent();
    await ex.getByRole("button", { name: "Newest" }).click();
    await expect.poll(async () => list.getByRole("listitem").first().textContent()).not.toBe(firstBefore);
    await ex.getByRole("button", { name: "type" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(4);
  });

  test("registry item is served", async ({ request }) => {
    const res = await request.get("/r/elastic-grid.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain("gridTemplateColumns");
    expect(item.meta.tier).toBe("premium");
  });
});
