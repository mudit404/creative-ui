import { expect, test } from "@playwright/test";

test.describe("field magnet", () => {
  test("documents the primitive and pulls toward the pointer", async ({ page }) => {
    await page.goto("/components/field-magnet");
    await expect(page.getByRole("heading", { level: 1, name: "Field Magnet" })).toBeVisible();
    for (const id of ["playground", "examples", "installation", "api", "accessibility", "performance", "source"]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const stage = page.getByTestId("playground-stage");
    const frame = stage.locator('[data-slot="field-magnet"]');
    const moving = frame.locator(":scope > *").first();
    const box = (await frame.boundingBox())!;

    // park far away: at rest, no transform
    await page.mouse.move(5, 5);
    await page.waitForTimeout(300);
    const restTransform = await moving.evaluate((el) => getComputedStyle(el).transform);

    // approach from above-right inside the radius
    await page.mouse.move(box.x + box.width + 40, box.y - 40, { steps: 10 });
    await page.waitForTimeout(400);
    await expect(frame).toHaveAttribute("data-active", "true");
    const pulled = await moving.evaluate((el) => {
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      return { x: m.m41, y: m.m42 };
    });
    expect(pulled.x).toBeGreaterThan(2);
    expect(pulled.y).toBeLessThan(-2);

    // leave: springs back
    await page.mouse.move(5, 5, { steps: 10 });
    await expect(frame).toHaveAttribute("data-active", "false");
    await expect
      .poll(async () => moving.evaluate((el) => getComputedStyle(el).transform), { timeout: 3000 })
      .toBe(restTransform);
  });

  test("playground controls drive the real component", async ({ page }) => {
    await page.goto("/components/field-magnet");
    const code = page.getByTestId("playground-code");
    await page.getByLabel("Button label").fill("Talk to us");
    await expect(page.getByTestId("playground-stage").getByRole("button", { name: "Talk to us" })).toBeVisible();
    await page.getByLabel("Spring", { exact: true }).selectOption("soft");
    await expect(code).toContainText('spring="soft"');
    await page.getByLabel("Disabled", { exact: true }).check();
    await expect(code).toContainText("disabled");
    await page.getByLabel("Reduced motion").check();
    await expect(page.getByTestId("playground-stage").locator('[data-slot="field-magnet"]')).toHaveAttribute("data-motion", "reduced");
  });

  test("registry item is served with its dependencies", async ({ request, baseURL }) => {
    const res = await request.get("/r/field-magnet.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].path).toBe("components/ui/field-magnet.tsx");
    for (const dep of item.registryDependencies as string[]) {
      if (!dep.startsWith("http")) continue;
      const d = await request.get(dep.replace(/^https?:\/\/[^/]+/, baseURL!));
      expect(d.ok(), dep).toBeTruthy();
    }
  });
});
