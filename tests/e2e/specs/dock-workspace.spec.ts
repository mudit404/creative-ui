import { expect, test, type Locator, type Page } from "@playwright/test";

/** Starts a tab drag and moves to a point given as fractions of the workspace; returns the root box measured after scrolling. */
async function dragTab(page: Page, root: Locator, tab: Locator, to: { fx: number; fy: number }) {
  await tab.scrollIntoViewIfNeeded(); // tab strips scroll horizontally; a clipped tab cannot be grabbed
  const b = (await tab.boundingBox())!;
  const box = (await root.boundingBox())!; // measured after any scrolling
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 12, b.y + b.height / 2 + 12, { steps: 2 });
  await page.mouse.move(box.x + box.width * to.fx, box.y + box.height * to.fy, { steps: 8 });
  return box;
}

test.describe("dock workspace", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  test("drag previews, proposes one layout on release, and cancels outside; menu and keyboard give the same moves", async ({ page }) => {
    await page.goto("/components/dock-workspace");
    await expect(page.getByRole("heading", { level: 1, name: "Dock Workspace" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const ex = page.getByTestId("example-studio");
    const root = ex.locator('[data-slot="dock-workspace"]');
    await expect(root).toHaveAttribute("data-measured", "true"); // hydrated and measured
    await expect(root).toHaveAttribute("data-state", "ready");
    await expect(ex.getByRole("tab")).toHaveCount(5);
    const log = ex.getByRole("list", { name: "Event log" });
    // cancel: release outside the workspace (Layers is the first, always-visible tab of the side group)
    let box = await dragTab(page, root, ex.getByRole("tab", { name: "Layers" }), { fx: 0.3, fy: 0.5 }); // centre of the main group → join as tab
    await expect(root).toHaveAttribute("data-state", "previewing");
    await expect(root.locator("[data-preview]")).toHaveAttribute("data-valid", "true");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height + 120, { steps: 4 });
    await expect(root.locator("[data-preview]")).toHaveAttribute("data-valid", "false");
    await page.mouse.up();
    await expect(root).toHaveAttribute("data-state", "ready");
    await expect(log).toContainText("no commits yet");
    // commit: drop on the left edge of the main group
    box = await dragTab(page, root, ex.getByRole("tab", { name: "Layers" }), { fx: 0.02, fy: 0.5 });
    await expect(root.locator("[data-preview]")).toHaveAttribute("data-valid", "true");
    await page.mouse.up();
    await expect(log.locator("li").first()).toContainText("onLayoutChange(move layers) → 3 groups");
    await expect(ex.getByRole("tablist")).toHaveCount(3);
    await expect(ex.getByRole("tab", { name: "Layers" })).toBeFocused();
    // menu: Move bottom on Properties (now the first tab of the side group)
    await ex.getByRole("button", { name: "Properties panel menu" }).click();
    await ex.getByRole("menuitem", { name: "Move bottom" }).click();
    await expect(log.locator("li").first()).toContainText("onLayoutChange(move props) → 4 groups");
    await expect(ex.getByRole("tab", { name: "Properties" })).toBeFocused();
    // keyboard resize on the first handle
    const handle = ex.getByRole("separator").first();
    const before = Number(await handle.getAttribute("aria-valuenow"));
    await handle.focus();
    await page.keyboard.press("ArrowRight");
    await expect(log.locator("li").first()).toContainText("onLayoutChange(resize)");
    expect(Number(await handle.getAttribute("aria-valuenow"))).not.toBe(before);
  });

  test("a declined close keeps the panel and its unsaved draft; an accepted close removes it and moves focus", async ({ page }) => {
    await page.goto("/components/dock-workspace");
    const ex = page.getByTestId("example-dirty");
    await ex.scrollIntoViewIfNeeded();
    await expect(ex.locator('[data-slot="dock-workspace"]')).toHaveAttribute("data-measured", "true");
    await ex.getByRole("tab", { name: "Notes" }).click();
    const draft = ex.getByRole("textbox", { name: "Notes draft" });
    await draft.fill("unsaved words");
    await ex.getByRole("button", { name: "Notes panel menu" }).click();
    await ex.getByRole("menuitem", { name: "Close" }).click();
    const log = ex.getByRole("list", { name: "Event log" });
    await expect(log).toContainText("onBeforeClose(notes) → declined (unsaved draft)");
    await expect(ex.getByRole("tab", { name: "Notes" })).toBeVisible();
    await expect(draft).toHaveValue("unsaved words");
    await expect(ex.getByRole("status")).toContainText("declined the close");
    await expect(log).not.toContainText("onLayoutChange(close");
    await draft.fill("");
    await ex.getByRole("button", { name: "Notes panel menu" }).click();
    await ex.getByRole("menuitem", { name: "Close" }).click();
    await expect(log).toContainText("onBeforeClose(notes) → allowed");
    await expect(ex.getByRole("tab", { name: "Notes" })).toHaveCount(0);
    await expect(log).toContainText("onLayoutChange(close notes)");
    await expect(ex.getByRole("tab", { name: "Output" })).toBeFocused();
  });

  test("invalid persisted layouts recover; narrow and over-constrained containers go compact; controlled hosts stay authoritative", async ({ page }) => {
    await page.goto("/components/dock-workspace");
    const invalid = page.getByTestId("example-invalid");
    await invalid.scrollIntoViewIfNeeded();
    await expect(invalid.locator('[data-slot="dock-workspace"]')).toHaveAttribute("data-recovered", "true");
    await expect(invalid.getByRole("status")).toContainText("could not be restored");
    await expect(invalid.getByRole("list", { name: "Event log" })).toContainText('onLayoutChange(recover: Unknown panel id "ghost".');
    await expect(invalid.getByRole("tab")).toHaveCount(5);

    const narrow = page.getByTestId("example-narrow");
    await narrow.scrollIntoViewIfNeeded();
    const small = narrow.locator("[data-narrow] [data-slot='dock-workspace']");
    await expect(small).toHaveAttribute("data-compact", "true");
    await expect(small.getByRole("tablist")).toHaveCount(1);
    await expect(small.getByRole("tab")).toHaveCount(5);
    await small.getByRole("tab", { name: "Output" }).click();
    await expect(small.getByText("Build output and logs.")).toBeVisible();
    const wide = narrow.locator("[data-oversized] [data-slot='dock-workspace']");
    await expect(wide).toHaveAttribute("data-compact", "true");
    await expect(wide.getByRole("status")).toContainText("do not fit");

    const ctl = page.getByTestId("example-controlled");
    await ctl.scrollIntoViewIfNeeded();
    await expect(ctl.locator('[data-slot="dock-workspace"]')).toHaveAttribute("data-measured", "true");
    await ctl.getByLabel(/Refuse proposals/).check();
    await ctl.getByRole("button", { name: "Layers panel menu" }).click();
    await ctl.getByRole("menuitem", { name: "Move bottom" }).click();
    await expect(ctl.getByRole("list", { name: "Event log" })).toContainText("onLayoutChange(move layers)");
    await expect(ctl.getByRole("tablist")).toHaveCount(2); // parent kept its layout
    await ctl.getByLabel(/Refuse proposals/).uncheck();
    await ctl.getByRole("button", { name: "Layers panel menu" }).click();
    await ctl.getByRole("menuitem", { name: "Move bottom" }).click();
    await expect(ctl.getByRole("tablist")).toHaveCount(3);

    const stage = page.getByTestId("playground-stage");
    await stage.scrollIntoViewIfNeeded();
    await expect(stage.locator('[data-slot="dock-workspace"]')).toHaveAttribute("data-state", "ready");
    await expect(page.getByTestId("playground-code")).toContainText("compactBreakpoint={360}");
  });
});
