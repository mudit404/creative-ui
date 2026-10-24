import { expect, test } from "../fixtures";

test.describe("activity capsule", () => {
  test("summary button expands a task list, morphs width and never nests actions", async ({ page }) => {
    await page.goto("/components/activity-capsule");
    await expect(page.getByRole("heading", { level: 1, name: "Activity Capsule" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const stage = page.getByTestId("playground-stage");
    const capsule = stage.locator('[data-slot="activity-capsule"]');
    const summary = capsule.getByRole("button", { name: /^Activity: Uploading 12 photos, Running, \d+%/ });
    await expect(summary).toHaveAttribute("aria-expanded", "false");
    const shellBefore = (await capsule.locator("> div").first().boundingBox())!.width;
    expect(shellBefore).toBeLessThan(260);
    await summary.click();
    await expect(summary).toHaveAttribute("aria-expanded", "true");
    await expect.poll(async () => (await capsule.locator("> div").first().boundingBox())!.width, { timeout: 3000 }).toBeGreaterThan(330);
    const region = capsule.getByRole("region", { name: "Activity tasks" });
    await expect(region.getByRole("listitem")).toHaveCount(1);
    await expect(region).toContainText(/\d+\/12 files \(\d+%\)/);
    expect(await summary.locator("button").count()).toBe(0);
    await page.keyboard.press("Escape");
    await expect(summary).toHaveAttribute("aria-expanded", "false");
    await expect(summary).toBeFocused();
  });

  test("cancel is a request; the host decides the outcome", async ({ page }) => {
    await page.goto("/components/activity-capsule");
    const ex = page.getByTestId("example-race");
    await ex.getByRole("button", { name: "Cancel Exporting report" }).click();
    await expect(ex.getByRole("list", { name: "Event log" })).toContainText("onCancelRequest(exp, a1)");
    await expect(ex.getByText("Cancel requested")).toBeVisible();
    await expect(ex.getByRole("button", { name: /Activity: Exporting report, Succeeded/ })).toBeVisible({ timeout: 3000 });
    await expect(ex.locator('[data-slot="activity-capsule"]').getByText("Cancelled", { exact: true })).toHaveCount(0);
    await expect(ex.getByRole("button", { name: "Dismiss Exporting report" })).toBeVisible();
  });

  test("retry starts a new attempt and stale events from the old one are ignored", async ({ page }) => {
    await page.goto("/components/activity-capsule");
    const ex = page.getByTestId("example-retry");
    await expect(ex.getByRole("button", { name: /Activity: Build site, Failed/ })).toBeVisible();
    await ex.getByRole("button", { name: "Retry Build site" }).click();
    const log = ex.getByRole("list", { name: "Event log" });
    await expect(log).toContainText("attempt 2");
    await expect(ex.getByRole("region").getByText("Running")).toBeVisible();
    await expect(log).toContainText("rejected", { timeout: 4000 });
    await expect(ex.getByRole("region").getByText("Running")).toBeVisible();
    await expect(ex.locator('[data-slot="activity-capsule"]').getByText("Succeeded", { exact: true })).toHaveCount(0);
  });

  test("indeterminate shows no percentage; queue counts active tasks; reduced motion keeps actions", async ({ page }) => {
    await page.goto("/components/activity-capsule");
    const ind = page.getByTestId("example-indeterminate");
    await expect(ind.getByRole("button", { name: "Activity: Generating summary, Running" })).toBeVisible();
    await expect(ind.locator('[data-slot="activity-capsule"]')).not.toContainText("%");
    const queue = page.getByTestId("example-queue");
    await expect(queue.getByRole("button", { name: /Task 2: Transcode, Running, \d+%, 14 active/ })).toBeVisible();
    await expect(queue.getByRole("listitem")).toHaveCount(20);
    await page.getByLabel("Reduced motion").check();
    const stage = page.getByTestId("playground-stage");
    await expect(stage.locator('[data-slot="activity-capsule"]')).toHaveAttribute("data-motion", "reduced");
    await expect(stage.getByRole("button", { name: "Cancel Uploading 12 photos" })).toBeVisible();
  });

  test("registry item is served with its lib dependency", async ({ request }) => {
    const res = await request.get("/r/activity-capsule.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain("reduceSnapshots");
    expect(item.registryDependencies.some((d: string) => d.endsWith("/r/task-snapshots.json"))).toBeTruthy();
  });
});
