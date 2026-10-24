import { expect, test } from "../fixtures";

test.describe("detent dial", () => {
  test("vertical drag previews, snaps to detents and commits once on release", async ({ page }) => {
    await page.goto("/components/detent-dial");
    await expect(page.getByRole("heading", { level: 1, name: "Detent Dial" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const stage = page.getByTestId("playground-stage");
    const knob = stage.getByRole("slider", { name: "Level" });
    await expect(knob).toHaveAttribute("aria-valuenow", "50");
    const box = (await knob.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 28, { steps: 8 }); // 28/120 of 100 ≈ +23 → 73, within 2% of detent 75 → snaps
    await expect(knob).toHaveAttribute("aria-valuenow", "75");
    await expect(stage.getByText(/commits: 0/)).toBeVisible();
    await page.mouse.move(cx, cy - 60, { steps: 8 }); // +50 → 100
    await expect(knob).toHaveAttribute("aria-valuenow", "100");
    await page.mouse.move(cx, cy - 400, { steps: 4 }); // far beyond: stays 100
    await expect(knob).toHaveAttribute("aria-valuenow", "100");
    await page.mouse.up();
    await expect(stage.getByText(/commits: 1/)).toBeVisible();
    await expect(stage.getByRole("list", { name: "Event log" })).toContainText("commit 100 · pointer · detent");
  });

  test("keyboard, fine steps, typing and Reset work without dragging; log fallback shows a diagnostic", async ({ page }) => {
    await page.goto("/components/detent-dial");
    const stage = page.getByTestId("playground-stage");
    const knob = stage.getByRole("slider", { name: "Level" });
    await knob.focus();
    await page.keyboard.press("ArrowUp");
    await expect(knob).toHaveAttribute("aria-valuenow", "51");
    await page.keyboard.press("Shift+ArrowDown");
    await expect(knob).toHaveAttribute("aria-valuenow", "50.9");
    await page.keyboard.press("Home");
    await expect(knob).toHaveAttribute("aria-valuenow", "0");
    const input = stage.getByRole("textbox", { name: "Level value" });
    await input.fill("abc");
    await input.press("Enter");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(knob).toHaveAttribute("aria-valuenow", "0");
    await input.fill("64");
    await input.press("Enter");
    await expect(knob).toHaveAttribute("aria-valuenow", "64");
    await stage.getByRole("button", { name: "Reset Level" }).click();
    await expect(knob).toHaveAttribute("aria-valuenow", "50"); // documented reset value = initial

    await page.getByLabel("Preset").selectOption("Broken log (min 0)");
    const root = stage.locator('[data-slot="detent-dial"]');
    await expect(root).toHaveAttribute("data-diagnostic", /log scale requires min > 0/);
    await expect(stage.getByRole("note")).toContainText("linear");
    await expect(page.getByTestId("playground-code")).toContainText('scale="log"');
  });

  test("stepped example commits detents only and reduced motion keeps controls", async ({ page }) => {
    await page.goto("/components/detent-dial");
    const ex = page.getByTestId("example-stepped");
    const knob = ex.getByRole("slider", { name: "Quality" });
    await expect(knob).toHaveAttribute("aria-valuetext", "Medium");
    await ex.getByRole("button", { name: "Increase Quality" }).click();
    await expect(knob).toHaveAttribute("aria-valuetext", "High");
    await expect(knob).toHaveAttribute("aria-valuenow", "75");
    await page.getByLabel("Reduced motion").check();
    await expect(page.getByTestId("playground-stage").locator('[data-slot="detent-dial"]')).toHaveAttribute("data-motion", "reduced");
    await expect(page.getByTestId("playground-stage").getByRole("button", { name: "Reset Level" })).toBeEnabled();
  });

  test("registry item is served", async ({ request }) => {
    const res = await request.get("/r/detent-dial.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain("resolveDetent");
  });
});
