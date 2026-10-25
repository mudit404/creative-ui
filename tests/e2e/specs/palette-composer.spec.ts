import { expect, test } from "../fixtures";

const svg = (body: string, w = 400, h = 300) => Buffer.from(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`);
const SIX = svg(["#dc281e", "#1e5ac8", "#28aa50", "#f0c828", "#783ca0", "#141414"].map((c, i) => `<rect x='${(i % 3) * 134}' y='${Math.floor(i / 3) * 150}' width='134' height='150' fill='${c}'/>`).join(""));

test.describe("palette composer", () => {
  test("extracts six editable slots from an uploaded image, with discs flying in", async ({ page }) => {
    await page.goto("/components/palette-composer");
    await expect(page.getByRole("heading", { level: 1, name: "Palette Composer" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const stage = page.getByTestId("playground-stage");
    // the playground preloads the six-colour fixture
    await expect(stage.getByRole("textbox", { name: "Slot 1 colour" })).toHaveValue(/^#[0-9a-f]{6}$/, { timeout: 10_000 });
    const values = await Promise.all([1, 2, 3, 4, 5, 6].map((n) => stage.getByRole("textbox", { name: `Slot ${n} colour` }).inputValue()));
    expect(new Set(values).size).toBe(6);
    await expect(stage.getByRole("list", { name: "Event log" })).toContainText("onPaletteChange(extract)");

    // upload a local file: a fresh extraction with disc flights (full motion)
    await stage.getByLabel("Choose image").setInputFiles({ name: "six.svg", mimeType: "image/svg+xml", buffer: SIX });
    await expect(stage.getByRole("img", { name: "six.svg" })).toBeVisible();
    await expect(stage.getByRole("textbox", { name: "Slot 1 colour" })).toHaveValue("#dc281e", { timeout: 10_000 });
    await expect(stage.getByRole("textbox", { name: "Slot 6 colour" })).toHaveValue("#141414");
    await expect(stage.getByRole("status").first()).toContainText("Palette ready: 6 colours");
  });

  test("locks survive re-extraction; edits validate; export is sanitised", async ({ page }) => {
    await page.goto("/components/palette-composer");
    const stage = page.getByTestId("playground-stage");
    const slot1 = stage.getByRole("textbox", { name: "Slot 1 colour" });
    await expect(slot1).toHaveValue(/^#/, { timeout: 10_000 });
    await slot1.fill("rgb(255, 0, 128)");
    await slot1.press("Enter");
    await expect(slot1).toHaveValue("#ff0080");
    await stage.getByRole("button", { name: "Lock Slot 1" }).click();
    await page.getByLabel("Image", { exact: true }).selectOption("mono");
    await expect(stage.getByRole("textbox", { name: "Slot 2 colour" })).toHaveValue(/^#5/, { timeout: 10_000 });
    await expect(slot1).toHaveValue("#ff0080");
    await expect(stage.getByRole("textbox", { name: "Slot 3 colour" })).toHaveValue("");
    await expect(stage.getByText("Unused").first()).toBeVisible();

    await page.getByLabel("Export prefix").fill("My Brand!");
    await stage.getByRole("button", { name: "Show CSS" }).click();
    await expect(stage.getByLabel("CSS export")).toHaveValue(/--my-brand-1: #ff0080;/);
    await expect(page.getByTestId("playground-code")).toContainText('exportPrefix="My Brand!"');
  });

  test("oversized and transparent fixtures behave; reduced motion keeps the workflow", async ({ page }) => {
    await page.goto("/components/palette-composer");
    const stage = page.getByTestId("playground-stage");
    await page.getByLabel("Image", { exact: true }).selectOption("huge");
    await expect(stage.getByRole("status").first()).toContainText(/limit is 24 MP/, { timeout: 10_000 });
    await expect(stage.locator('[data-slot="palette-composer"]')).toHaveAttribute("data-state", "error");
    await page.getByLabel("Image", { exact: true }).selectOption("transparent");
    await expect(stage.getByRole("textbox", { name: "Slot 1 colour" })).toHaveValue("#0000ff", { timeout: 10_000 });
    await expect(stage.getByRole("textbox", { name: "Slot 2 colour" })).toHaveValue("");
    await page.getByLabel("Reduced motion").check();
    await expect(stage.locator('[data-slot="palette-composer"]')).toHaveAttribute("data-motion", "reduced");
    await stage.getByRole("button", { name: "Lock Slot 1" }).click();
    await expect(stage.getByRole("button", { name: "Lock Slot 1" })).toHaveAttribute("aria-pressed", "true");
  });

  test("race example keeps B's palette and clipboard denial falls back to selectable CSS", async ({ page }) => {
    await page.goto("/components/palette-composer");
    const race = page.getByTestId("example-race");
    await race.getByRole("button", { name: /Load A, then B/ }).click();
    await expect(race.getByRole("img", { name: "B (six colours)" })).toBeVisible();
    await expect(race.getByRole("textbox", { name: "Slot 1 colour" })).toHaveValue("#dc281e", { timeout: 10_000 });
    await page.waitForTimeout(1800); // A's slow decode would have finished by now
    await expect(race.getByRole("textbox", { name: "Slot 1 colour" })).toHaveValue("#dc281e");
    const log = race.getByRole("list", { name: "Event log" });
    await expect(log).toContainText("onPaletteChange(extract");
    expect((await log.textContent())!.match(/onPaletteChange/g)!.length).toBe(1);

    const clip = page.getByTestId("example-clipboard");
    await clip.getByRole("checkbox", { name: "Simulate denied clipboard" }).check();
    await clip.getByRole("button", { name: "Copy CSS" }).click();
    await expect(clip.getByText(/clipboard access was denied/)).toBeVisible();
    await expect(clip.getByLabel("CSS export")).toBeVisible();
    await expect(clip.getByLabel("CSS export")).toHaveValue(/--palette-1: #ff4d1c;/);
  });

  test("registry item is served with its lib dependency", async ({ request }) => {
    const res = await request.get("/r/palette-composer.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain("browserDecoder");
    expect(item.registryDependencies.some((d: string) => d.endsWith("/r/palette-extract.json"))).toBeTruthy();
  });
});
