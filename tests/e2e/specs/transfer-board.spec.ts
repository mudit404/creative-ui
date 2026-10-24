import { expect, test } from "@playwright/test";

test.describe("transfer board", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  test("Move menu emits an addressed request; the host applies it; undo reverses", async ({ page }) => {
    await page.goto("/components/transfer-board");
    await expect(page.getByRole("heading", { level: 1, name: "Transfer Board" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const stage = page.getByTestId("playground-stage");
    await page.getByLabel("Host delay (demo)").fill("0");
    const log = stage.getByRole("list", { name: "Event log" });
    await stage.getByRole("button", { name: "Move Rotate the staging certificates" }).click();
    const dialog = stage.getByRole("dialog", { name: "Move Rotate the staging certificates" });
    await expect(dialog.getByLabel("Destination")).toBeFocused();
    await dialog.getByLabel("Destination").selectOption("archive");
    await expect(dialog.getByRole("alert")).toContainText("Archive is read-only.");
    await dialog.getByLabel("Destination").selectOption("done");
    await expect(dialog.getByRole("alert")).toContainText("Start it first");
    await dialog.getByLabel("Destination").selectOption("doing");
    await dialog.getByLabel("Position").selectOption("t5");
    await dialog.getByRole("button", { name: "Move here" }).click();
    await expect(log).toContainText("onMoveRequest(t2 → doing before t5, rev 1)");
    await expect(log).toContainText("host → accepted");
    const doing = stage.getByRole("list", { name: "Doing items" });
    await expect(doing.getByRole("listitem")).toHaveCount(3);
    await expect(doing.getByRole("listitem").first()).toContainText("Rotate the staging certificates");
    await expect(stage.getByRole("button", { name: "Move Rotate the staging certificates" })).toBeFocused();
    await expect(stage.getByRole("status")).toContainText("moved to Doing");

    await stage.getByRole("button", { name: "Undo last move" }).click();
    await expect(log).toContainText("onUndoRequest(t2 → todo before t3, rev 2)");
    await expect(stage.getByRole("list", { name: "To do items" }).getByRole("listitem").nth(1)).toContainText("Rotate the staging certificates");
  });

  test("handle drag previews with a placeholder, blocks refused columns, and drops once", async ({ page }) => {
    await page.goto("/components/transfer-board");
    const stage = page.getByTestId("example-workflow"); // full width: all four columns visible
    const handle = stage.getByRole("button", { name: "Drag Fix the flaky gallery test" });
    const done = stage.locator('[data-container="done"]');
    await handle.scrollIntoViewIfNeeded();
    const hb = (await handle.boundingBox())!;
    const db = (await done.boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(db.x + db.width / 2, db.y + 80, { steps: 10 });
    await expect(done).toHaveAttribute("data-target", "blocked"); // todo → done is refused by canMove
    await expect(stage.getByRole("status")).toContainText("Start it first");
    await expect(stage.locator("[data-drag-preview]")).toBeVisible();
    const doing = stage.locator('[data-container="doing"]');
    const gb = (await doing.boundingBox())!;
    await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height - 30, { steps: 10 });
    await expect(doing).toHaveAttribute("data-target", "valid");
    await expect(doing.locator("[data-placeholder]")).toHaveCount(1);
    await expect(stage.getByRole("heading", { name: "Doing" }).locator("xpath=..")).toContainText("2/3"); // authoritative count
    await page.mouse.up();
    const log = stage.getByRole("list", { name: "Event log" });
    await expect(log).toContainText("onMoveRequest(t3 → doing, rev 1)");
    await expect(stage.locator("[data-drag-preview]")).toHaveCount(0);
    await expect(stage.getByRole("list", { name: "Doing items" }).getByRole("listitem")).toHaveCount(3, { timeout: 3000 });
    expect((await log.textContent())!.match(/onMoveRequest/g)!.length).toBe(1);
  });

  test("Escape cancels a drag; a refusing host restores; duplicate ids disable moves", async ({ page }) => {
    await page.goto("/components/transfer-board");
    const wf = page.getByTestId("example-workflow");
    const handle = wf.getByRole("button", { name: "Drag Design the empty state" });
    await handle.scrollIntoViewIfNeeded();
    const hb = (await handle.boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + 200, hb.y + 100, { steps: 6 });
    await expect(wf.locator('[data-slot="transfer-board"]')).toHaveAttribute("data-state", "preview");
    await page.keyboard.press("Escape");
    await expect(wf.locator('[data-slot="transfer-board"]')).toHaveAttribute("data-state", "idle");
    await expect(wf.locator("[data-drag-preview]")).toHaveCount(0);
    await expect(wf.getByRole("status")).toContainText("Drag cancelled.");
    await page.mouse.up();

    const stage = page.getByTestId("playground-stage");

    await page.getByLabel("Preset").selectOption("Refusing host");
    await page.getByLabel("Host delay (demo)").fill("0");
    await stage.getByRole("button", { name: "Move Review PR 418" }).click();
    await stage.getByRole("dialog").getByLabel("Destination").selectOption("done");
    await stage.getByRole("dialog").getByRole("button", { name: "Move here" }).click();
    await expect(stage.getByRole("status")).toContainText("Host refused");
    await expect(stage.getByRole("list", { name: "Doing items" }).getByRole("listitem")).toHaveCount(2);
    await expect(stage.getByRole("button", { name: "Move Review PR 418" })).toBeFocused();

    const invalid = page.getByTestId("example-invalid");
    await expect(invalid.getByRole("note")).toContainText('item "t1" appears in "todo" and "doing"');
    await expect(invalid.getByRole("button", { name: /^Move Write the release notes/ }).first()).toBeDisabled();
  });

  test("external reorder cancels an in-flight drag; reduced motion keeps everything", async ({ page }) => {
    await page.goto("/components/transfer-board");
    const ex = page.getByTestId("example-external");
    await ex.getByRole("button", { name: /Reorder from the server/ }).click();
    const handle = ex.getByRole("button", { name: "Drag Rotate the staging certificates" });
    const hb = (await handle.boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + 300, hb.y + 60, { steps: 6 });
    await expect(ex.locator('[data-slot="transfer-board"]')).toHaveAttribute("data-state", "preview");
    await expect(ex.locator('[data-slot="transfer-board"]')).toHaveAttribute("data-state", "idle", { timeout: 5000 });
    await expect(ex.getByRole("status")).toContainText("the drag was cancelled");
    await expect(ex.getByRole("list", { name: "To do items" }).getByRole("listitem").first()).toContainText("Design the empty state");
    await page.mouse.up();

    await page.getByLabel("Reduced motion").check();
    const stage = page.getByTestId("playground-stage");
    await expect(stage.locator('[data-slot="transfer-board"]')).toHaveAttribute("data-motion", "reduced");
    await expect(stage.getByRole("button", { name: "Move Review PR 418" })).toBeEnabled();
  });

  test("registry item is served with its lib dependencies", async ({ request }) => {
    const res = await request.get("/r/transfer-board.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain("onMoveRequest");
    expect(item.registryDependencies.some((d: string) => d.endsWith("/r/board-moves.json"))).toBeTruthy();
  });
});
