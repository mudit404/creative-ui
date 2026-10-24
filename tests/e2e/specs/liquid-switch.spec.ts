import { expect, test } from "@playwright/test";

test.describe("liquid switch", () => {
  test("toggles by pointer and keyboard, with the thumb travelling", async ({ page }) => {
    await page.goto("/components/liquid-switch");
    await expect(page.getByRole("heading", { level: 1, name: "LiquidSnap Toggle" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const stage = page.getByTestId("playground-stage");
    const sw = stage.getByRole("switch", { name: "Email notifications" });
    await expect(sw).toHaveAttribute("aria-checked", "false");
    const thumb = sw.locator("ellipse").first();
    const before = Number(await thumb.getAttribute("cx"));

    await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", "true");
    await expect.poll(async () => Number(await thumb.getAttribute("cx")), { timeout: 3000 }).toBeGreaterThan(before + 15);

    await sw.focus();
    await page.keyboard.press("Space");
    await expect(sw).toHaveAttribute("aria-checked", "false");
    await expect.poll(async () => Number(await thumb.getAttribute("cx")), { timeout: 3000 }).toBeLessThan(before + 1);
  });

  test("playground drives the real component and generated code", async ({ page }) => {
    await page.goto("/components/liquid-switch");
    const stage = page.getByTestId("playground-stage");
    const code = page.getByTestId("playground-code");
    await page.getByLabel("Size").selectOption("lg");
    await expect(stage.getByRole("switch")).toHaveCSS("width", "68px");
    await expect(code).toContainText('size="lg"');
    await page.getByLabel("Checked initially").check();
    await expect(stage.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    await expect(code).toContainText("defaultChecked");
    await page.getByLabel("Reduced motion").check();
    await expect(stage.getByRole("switch")).toHaveAttribute("data-motion", "reduced");
    await expect(stage.locator("filter")).toHaveCount(0);
  });

  test("form example submits the switch value", async ({ page }) => {
    await page.goto("/components/liquid-switch");
    const form = page.getByTestId("example-form").locator("form");
    page.once("dialog", (d) => d.accept());
    const dialog = page.waitForEvent("dialog");
    await form.getByRole("switch").click();
    await form.getByRole("button", { name: "Save" }).click();
    expect((await dialog).message()).toBe("marketing=yes");
  });

  test("registry item is served", async ({ request }) => {
    const res = await request.get("/r/liquid-switch.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain('role="switch"');
  });
});
