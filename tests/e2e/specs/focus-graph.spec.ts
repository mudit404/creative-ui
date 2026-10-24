import { expect, test } from "../fixtures";

test.describe("focus graph", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  test("list and canvas select the same node; directed neighbours; invalid edge diagnosed", async ({ page }) => {
    await page.goto("/components/focus-graph");
    await expect(page.getByRole("heading", { level: 1, name: "Focus Graph" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const stage = page.getByTestId("playground-stage");
    await expect(stage.getByRole("note")).toContainText('Edge "c14" references a missing node (ledger).');
    await expect(stage.locator('[data-slot="focus-graph"]')).toHaveAttribute("data-settled", "true");
    await stage.getByRole("list", { name: "Nodes" }).getByRole("button", { name: "Orders" }).click();
    const details = stage.locator("[data-details]");
    await expect(details.getByRole("list", { name: "Depends on" })).toContainText("Payments");
    await expect(details.getByRole("list", { name: "Depends on" })).toContainText("Mailer");
    await expect(details.getByRole("list", { name: "Used by" })).toContainText("API gateway");
    await expect(stage.locator('[data-node="orders"]')).toHaveAttribute("data-selected", "true");
    await expect(stage.locator('[data-node="es"]')).toHaveAttribute("data-muted", "true");
    await stage.locator('[data-node="pg"] circle').click();
    await expect(details).toContainText("Postgres");
    await expect(details.getByRole("list", { name: "Used by" })).toContainText("Orders");
    await details.getByRole("list", { name: "Used by" }).getByRole("button", { name: "Catalog" }).click();
    await expect(details).toContainText("Catalog");
  });

  test("search filters the list only; camera buttons change the viewBox; focus centres the node", async ({ page }) => {
    await page.goto("/components/focus-graph");
    const stage = page.getByTestId("playground-stage");
    await stage.getByRole("searchbox", { name: "Search nodes" }).fill("pay");
    await expect(stage.getByRole("list", { name: "Nodes" }).getByRole("button")).toHaveCount(1);
    await expect(stage.locator("[data-node]")).toHaveCount(12);
    const svg = stage.locator("[data-canvas]");
    const before = await svg.getAttribute("viewBox");
    await stage.getByRole("button", { name: "Zoom in" }).click();
    await expect.poll(() => svg.getAttribute("viewBox")).not.toBe(before);
    await stage.getByRole("list", { name: "Nodes" }).getByRole("button", { name: "Payments" }).click();
    await stage.getByRole("button", { name: "Focus" }).click();
    await expect.poll(async () => {
      const vb = (await svg.getAttribute("viewBox"))!.split(" ").map(Number);
      const [x, y] = await stage.locator('[data-node="payments"]').evaluate((g) => {
        const m = new DOMMatrixReadOnly(getComputedStyle(g).transform);
        return [m.m41, m.m42];
      });
      return Math.abs(vb[0]! + vb[2]! / 2 - x!) < 2 && Math.abs(vb[1]! + vb[3]! / 2 - y!) < 2;
    }, { timeout: 3000 }).toBe(true);
    await stage.getByRole("button", { name: "Fit" }).click();
  });

  test("authored positions, live deletion, 300-node stress and reduced motion", async ({ page }) => {
    await page.goto("/components/focus-graph");
    const authored = page.getByTestId("example-authored");
    await expect(authored.locator('[data-slot="focus-graph"]')).toHaveAttribute("data-layout", "authored");
    const [cx, cy] = await authored.locator('[data-node="colour"]').evaluate((g) => {
      const m = new DOMMatrixReadOnly(getComputedStyle(g).transform);
      return [m.m41, m.m42];
    });
    expect(Math.round(cx!)).toBe(80);
    expect(Math.round(cy!)).toBe(70);

    const del = page.getByTestId("example-deletion");
    await del.scrollIntoViewIfNeeded();
    await expect(del.locator("[data-details]")).toContainText("Orders");
    await del.getByRole("button", { name: /Delete selected/ }).click();
    await expect(del.locator("[data-details]")).toContainText('"orders" was removed');
    await expect(del.locator('[data-node="orders"]')).toHaveCount(0);

    const stress = page.getByTestId("example-stress");
    await stress.scrollIntoViewIfNeeded();
    await expect(stress.locator("[data-node]")).toHaveCount(300);
    await expect(stress.locator('[data-slot="focus-graph"]')).toHaveAttribute("data-layout", "seeded-force");

    await page.getByLabel("Reduced motion").check();
    const stage = page.getByTestId("playground-stage");
    await expect(stage.locator('[data-slot="focus-graph"]')).toHaveAttribute("data-motion", "reduced");
    await expect(stage.getByRole("list", { name: "Nodes" }).getByRole("button").first()).toBeVisible();
  });

  test("registry item ships only the 2D path and its lib dependency", async ({ request }) => {
    const res = await request.get("/r/focus-graph.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain("forceLayout");
    expect(item.dependencies).not.toContain("three");
    expect(item.dependencies).not.toContain("react-force-graph");
    expect(item.registryDependencies.some((d: string) => d.endsWith("/r/graph-model.json"))).toBeTruthy();
  });
});
