import { expect, test } from "../fixtures";

test.describe("elastic range", () => {
  test("drag previews, releases commit once, and overshoot never leaks into the value", async ({ page }) => {
    await page.goto("/components/elastic-range");
    await expect(page.getByRole("heading", { level: 1, name: "Elastic Range" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const stage = page.getByTestId("playground-stage");
    const slider = stage.getByRole("slider", { name: "Value" });
    await expect(slider).toHaveAttribute("aria-valuenow", "50");
    const track = stage.locator(".touch-none");
    const box = (await track.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2, { steps: 5 });
    await expect(slider).toHaveAttribute("aria-valuenow", "75");
    await expect(stage.getByText(/commits: 0/)).toBeVisible();
    // 300px past the end: still 100, and the track bows (decoration) only while held
    await page.mouse.move(box.x + box.width + 300, box.y + box.height / 2, { steps: 6 });
    await expect(slider).toHaveAttribute("aria-valuenow", "100");
    await expect.poll(async () => (await track.locator("path").getAttribute("d")) ?? "").not.toBe("M 0 4 Q 50 4 100 4");
    await page.mouse.up();
    await expect(stage.getByText(/commits: 1/)).toBeVisible();
    await expect(stage.getByRole("list", { name: "Event log" })).toContainText("commit 100 · pointer");
    await expect.poll(async () => (await track.locator("path").getAttribute("d")) ?? "", { timeout: 3000 }).toBe("M 0 4 Q 50 4 100 4");
  });

  test("keyboard, buttons and typing reach every value; playground drives props and code", async ({ page }) => {
    await page.goto("/components/elastic-range");
    const stage = page.getByTestId("playground-stage");
    const code = page.getByTestId("playground-code");
    const slider = stage.getByRole("slider", { name: "Value" });
    await slider.focus();
    await page.keyboard.press("End");
    await expect(slider).toHaveAttribute("aria-valuenow", "100");
    await page.keyboard.press("PageDown");
    await expect(slider).toHaveAttribute("aria-valuenow", "90");
    await stage.getByRole("button", { name: "Decrease Value value" }).click();
    await expect(slider).toHaveAttribute("aria-valuenow", "89");
    const input = stage.getByRole("textbox", { name: "Value value" });
    await input.fill("42");
    await input.press("Enter");
    await expect(slider).toHaveAttribute("aria-valuenow", "42");
    await expect(stage.getByText(/commits: 4/)).toBeVisible();

    await page.getByLabel("Variant").selectOption("interval");
    await expect(stage.getByRole("slider", { name: "Lower bound" })).toBeVisible();
    await expect(stage.getByRole("slider", { name: "Upper bound" })).toBeVisible();
    await expect(code).toContainText('variant="interval"');
    await page.getByLabel("Reduced motion").check();
    await expect(stage.locator('[data-slot="elastic-range"]')).toHaveAttribute("data-motion", "reduced");
  });

  test("interval example enforces the minimum gap and form example submits lower/upper", async ({ page }) => {
    await page.goto("/components/elastic-range");
    const ex = page.getByTestId("example-interval");
    const lower = ex.getByRole("slider", { name: "Minimum price" });
    const upper = ex.getByRole("slider", { name: "Maximum price" });
    await expect(upper).toHaveAttribute("aria-valuenow", "650");
    await lower.focus();
    for (let i = 0; i < 6; i++) await page.keyboard.press("PageUp"); // 200 → 800 attempted
    await expect(lower).toHaveAttribute("aria-valuenow", "600"); // capped at upper − gap
    await expect(upper).toHaveAttribute("aria-valuenow", "650");

    const form = page.getByTestId("example-form").locator("form");
    page.once("dialog", (d) => d.accept());
    const dialog = page.waitForEvent("dialog");
    await form.getByRole("button", { name: "Save" }).click();
    expect((await dialog).message()).toBe("budget.lower=20&budget.upper=60");
  });

  test("registry item is served with its lib dependency", async ({ request }) => {
    const res = await request.get("/r/elastic-range.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain('role="slider"');
    expect(item.registryDependencies.some((d: string) => d.endsWith("/r/bounded-value.json"))).toBeTruthy();
    expect((await request.get("/r/bounded-value.json")).ok()).toBeTruthy();
  });
});
