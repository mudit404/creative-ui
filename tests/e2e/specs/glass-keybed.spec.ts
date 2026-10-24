import { expect, test } from "@playwright/test";

test.describe("glass keybed", () => {
  test("silent on mount; enabling sound is explicit; one activation is one note by pointer or keyboard", async ({ page }) => {
    await page.goto("/components/glass-keybed");
    await expect(page.getByRole("heading", { level: 1, name: "Glass Keybed" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const ex = page.getByTestId("example-glass");
    const root = ex.locator('[data-slot="glass-keybed"]');
    await expect(root).toHaveAttribute("data-audio", "silent");
    await expect(ex.getByRole("status")).toContainText("Silent until you enable sound.");
    await ex.getByRole("button", { name: "Enable sound" }).click();
    await expect(root).toHaveAttribute("data-audio", /ready|blocked/, { timeout: 5000 });
    const log = ex.getByRole("list", { name: "Event log" });
    await expect(log).toContainText("onSoundEnabledChange(");
    await ex.getByRole("button", { name: "C4 note" }).click();
    await expect(log).toContainText("onNoteOn(c4, v0.8, pointer)");
    expect(await log.locator("li").filter({ hasText: "onNoteOn" }).count()).toBe(1);
    await ex.getByRole("button", { name: "E4 note" }).focus();
    await page.keyboard.press("Enter");
    await expect(log).toContainText("onNoteOn(e4, v0.8, keyboard)");
    expect(await log.locator("li").filter({ hasText: "onNoteOn" }).count()).toBe(2);
    await expect(ex.getByRole("button", { name: "E4 note" })).toHaveAttribute("data-active", "true");
  });

  test("sustained notes are bounded by polyphony and Stop all releases them", async ({ page }) => {
    await page.goto("/components/glass-keybed");
    const ex = page.getByTestId("example-sustained");
    await ex.scrollIntoViewIfNeeded();
    const root = ex.locator('[data-slot="glass-keybed"]');
    await expect(root).toHaveAttribute("data-variant", "opaque-accessible");
    await expect(root).toHaveAttribute("data-trigger", "sustained");
    const log = ex.getByRole("list", { name: "Event log" });
    for (const [i, n] of ["C4", "D4", "E4", "G4"].entries()) {
      await ex.getByRole("button", { name: `${n} note` }).dispatchEvent("pointerdown", { button: 0, pointerId: i + 1, isPrimary: true, bubbles: true });
    }
    await expect(log).toContainText("onNoteOff(c4, evicted)");
    expect(await log.locator("li").filter({ hasText: "onNoteOn" }).count()).toBe(4);
    await ex.getByRole("button", { name: "Stop all" }).click();
    expect(await log.locator("li").filter({ hasText: "stopAll" }).count()).toBe(3);
    await expect(ex.locator("[data-active]")).toHaveCount(0);
  });

  test("visual-only and blocked audio stay usable instruments; the playground generates code", async ({ page }) => {
    await page.goto("/components/glass-keybed");
    const visual = page.getByTestId("example-visual");
    await visual.scrollIntoViewIfNeeded();
    await expect(visual.locator('[data-slot="glass-keybed"]')).toHaveAttribute("data-audio", "visual-only");
    await expect(visual.getByRole("button", { name: "Enable sound" })).toHaveCount(0);
    await visual.getByRole("button", { name: "A4 note" }).click();
    await expect(visual.getByRole("list", { name: "Event log" })).toContainText("onNoteOn(a4");

    const blocked = page.getByTestId("example-blocked");
    await blocked.scrollIntoViewIfNeeded();
    await blocked.getByRole("button", { name: "Enable sound" }).click();
    await expect(blocked.locator('[data-slot="glass-keybed"]')).toHaveAttribute("data-audio", "blocked", { timeout: 5000 });
    await expect(blocked.getByRole("status")).toContainText("Visual-only mode is active.");
    await expect(blocked.getByRole("list", { name: "Event log" })).toContainText("onSoundEnabledChange(false, blocked)");
    await blocked.getByRole("button", { name: "C5 note" }).click();
    await expect(blocked.getByRole("list", { name: "Event log" })).toContainText("onNoteOn(c5");

    const stage = page.getByTestId("playground-stage");
    await stage.scrollIntoViewIfNeeded();
    await expect(stage.locator('[data-slot="glass-keybed"]')).toHaveAttribute("data-audio", "silent");
    await expect(page.getByTestId("playground-code")).toContainText("<GlassKeybed");
  });
});
