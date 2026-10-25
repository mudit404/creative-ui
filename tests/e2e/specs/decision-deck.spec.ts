import { expect, test } from "../fixtures";

test.describe("decision deck", () => {
  test("swipe commits once, pending locks the controls, the host advances the deck", async ({ page }) => {
    await page.goto("/components/decision-deck");
    await expect(page.getByRole("heading", { level: 1, name: "Decision Deck" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const stage = page.getByTestId("playground-stage");
    const card = stage.getByRole("group", { name: "Rename the billing page" });
    const box = (await card.boundingBox())!;
    // short swipe: resets
    await page.mouse.move(box.x + box.width / 2, box.y + 30);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + 30, { steps: 5 });
    await page.mouse.up();
    await expect(stage.getByRole("list", { name: "Event log" })).not.toContainText("onDecisionRequest");
    // long swipe right: one request
    await page.mouse.move(box.x + box.width / 2, box.y + 30);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + box.width * 0.45, box.y + 30, { steps: 8 });
    await expect(stage.locator('[data-slot="decision-deck"]')).toHaveAttribute("data-state", "dragging");
    await page.mouse.up();
    const log = stage.getByRole("list", { name: "Event log" });
    await expect(log).toContainText("onDecisionRequest(c1, accept, pointer)");
    await expect(stage.getByRole("button", { name: "Approve" })).toBeDisabled();
    await expect(stage.getByRole("status")).toContainText("Approve requested…");
    await stage.getByRole("button", { name: "Approve" }).click({ force: true }).catch(() => {});
    await expect(log).toContainText("host → accepted c1", { timeout: 3000 });
    await expect(stage.getByRole("group", { name: "Bump node to 24" })).toBeVisible();
    await expect(stage.getByText("4 remaining")).toBeVisible();
    expect((await log.textContent())!.match(/onDecisionRequest/g)!.length).toBe(1);
    await expect(stage.getByRole("button", { name: "Approve" })).toBeFocused();
  });

  test("a refused request restores the card with the message; undo waits for the host", async ({ page }) => {
    await page.goto("/components/decision-deck");
    const stage = page.getByTestId("playground-stage");
    await page.getByLabel("Host delay (demo)").fill("0");
    const approve = stage.getByRole("button", { name: "Approve" });
    await approve.click();
    await expect(stage.getByRole("group", { name: "Bump node to 24" })).toBeVisible();
    await approve.click();
    await expect(stage.getByRole("group", { name: "Delete the legacy exporter" })).toBeVisible();
    await approve.click(); // card 3 is refused once
    await expect(stage.getByRole("status")).toContainText("Host refused");
    await expect(stage.getByRole("group", { name: "Delete the legacy exporter" })).toBeVisible();
    await expect(approve).toBeEnabled();
    await stage.getByRole("button", { name: "Undo" }).click();
    await expect(stage.getByRole("status")).toContainText("Decision undone.");
    await expect(stage.getByRole("group", { name: "Bump node to 24" })).toBeVisible();
    await expect(stage.getByText("1 decided")).toBeVisible();
  });

  test("keyboard completes a deck; reduced motion; editable content stays usable", async ({ page }) => {
    await page.goto("/components/decision-deck");
    const stage = page.getByTestId("playground-stage");
    await page.getByLabel("Host delay (demo)").fill("0");
    await page.getByLabel("Host refuses card 3 (demo)").uncheck();
    await page.getByLabel("Reduced motion").check();
    await expect(stage.locator('[data-slot="decision-deck"]')).toHaveAttribute("data-motion", "reduced");
    await stage.getByRole("group", { name: "Rename the billing page" }).focus();
    for (const key of ["ArrowRight", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight"]) {
      await page.keyboard.press(key);
      await expect(stage.getByRole("status")).not.toContainText("requested…");
      if (await stage.locator('[data-card="active"]').count()) await stage.locator('[data-card="active"]').focus();
    }
    await expect(stage.getByText("5 decisions recorded.")).toBeVisible();
    await expect(stage.getByRole("status")).toContainText("Deck complete.");
    await expect(stage.getByRole("button", { name: "Undo" })).toBeEnabled();

    const ex = page.getByTestId("example-editable");
    const notes = ex.getByRole("textbox", { name: "Notes for Rename the billing page" });
    await notes.fill("looks fine");
    await expect(notes).toHaveValue("looks fine");
    const nb = (await notes.boundingBox())!;
    await page.mouse.move(nb.x + 10, nb.y + 10);
    await page.mouse.down();
    await page.mouse.move(nb.x + 250, nb.y + 10, { steps: 6 });
    await page.mouse.up();
    await expect(ex.getByRole("group", { name: "Rename the billing page" })).toBeVisible();
  });

  test("registry item is served", async ({ request }) => {
    const res = await request.get("/r/decision-deck.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain("onDecisionRequest");
    expect(item.registryDependencies.some((d: string) => d.endsWith("/r/transactions.json"))).toBeTruthy();
  });
});
