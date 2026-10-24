import { expect, test } from "@playwright/test";

test.describe("time lens", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  test("brushing previews and commits; zoom and the editor are equivalent", async ({ page }) => {
    await page.goto("/components/time-lens");
    await expect(page.getByRole("heading", { level: 1, name: "Time Lens" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const stage = page.getByTestId("playground-stage");
    const log = stage.getByRole("list", { name: "Event log" });
    const start = stage.getByRole("slider", { name: "Window start" });
    const t0 = Number(await start.getAttribute("aria-valuemin"));
    const H = 36e5;
    expect(Number(await start.getAttribute("aria-valuenow"))).toBe(t0 + 5 * H);
    const win = stage.locator("[data-window]");
    const wb = (await win.boundingBox())!;
    await page.mouse.move(wb.x + wb.width / 2, wb.y + wb.height / 2);
    await page.mouse.down();
    await page.mouse.move(wb.x + wb.width / 2 + 60, wb.y + wb.height / 2, { steps: 6 });
    await expect(stage.locator('[data-slot="time-lens"]')).toHaveAttribute("data-state", "brushing");
    await expect(log).not.toContainText("· pan");
    await page.mouse.up();
    await expect(log).toContainText("· pan");
    const after = Number(await start.getAttribute("aria-valuenow"));
    expect(after).toBeGreaterThan(t0 + 5 * H);

    await stage.getByRole("button", { name: "Zoom in" }).click();
    await expect(log).toContainText("· zoom");
    const s = stage.getByRole("textbox", { name: "Window start (ISO)" });
    const e = stage.getByRole("textbox", { name: "Window end (ISO)" });
    await s.fill("2026-03-08T06:00:00Z");
    await e.fill("2026-03-08T09:00:00Z");
    await stage.getByRole("button", { name: "Apply" }).click();
    await expect(log).toContainText("commit 06:00–09:00Z · editor");
    await expect(start).toHaveAttribute("aria-valuenow", String(Date.UTC(2026, 2, 8, 6)));
    await e.fill("2026-03-08T02:30");
    await stage.getByRole("button", { name: "Apply" }).click();
    await expect(stage.getByRole("alert")).toContainText("offset");
  });

  test("equal intervals take equal space; DST display keeps order; list selection brings events into view", async ({ page }) => {
    await page.goto("/components/time-lens");
    const ex = page.getByTestId("example-incidents");
    await ex.scrollIntoViewIfNeeded();
    const alarm = ex.getByRole("button", { name: /^Alarm fired, / });
    const rollback = ex.getByRole("button", { name: /^Rollback to 2.3, / });
    const resolved = ex.getByRole("button", { name: /^Resolved, / });
    const a = (await alarm.boundingBox())!.x;
    const r = (await rollback.boundingBox())!.x;
    const z = (await resolved.boundingBox())!.x;
    expect(Math.abs((r - a) - ((z - r) * 1) / 1.75)).toBeLessThan(3); // 1h vs 1.75h gaps
    await expect(alarm).toHaveAccessibleName(/01:30/); // 06:30Z is 01:30 EST on the DST day
    await expect(rollback).toHaveAccessibleName(/03:30/); // 07:30Z is 03:30 EDT
    await ex.getByRole("button", { name: "UTC" }).click();
    await expect(alarm).toHaveAccessibleName(/06:30/);
    await expect(ex.getByRole("button", { name: /^Postmortem, / })).toHaveCount(0);
    await ex.getByRole("list", { name: /All events/ }).getByRole("button", { name: /Postmortem/ }).click();
    await expect(ex.getByRole("button", { name: /^Postmortem, / })).toBeVisible();
    await expect(ex.locator("[data-details]")).toContainText("Postmortem");
  });

  test("wheel does not scroll-zoom by default; 500 events render; reduced motion drops transitions", async ({ page }) => {
    await page.goto("/components/time-lens");
    const stage = page.getByTestId("playground-stage");
    const lane = stage.getByRole("region", { name: /^Detail/ });
    const before = await stage.getByRole("slider", { name: "Window start" }).getAttribute("aria-valuenow");
    const lb = (await lane.boundingBox())!;
    await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2);
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore);
    expect(await stage.getByRole("slider", { name: "Window start" }).getAttribute("aria-valuenow")).toBe(before);

    const stress = page.getByTestId("example-stress");
    await stress.scrollIntoViewIfNeeded();
    await expect(stress.getByRole("list", { name: /All events \(500\)/ })).toBeVisible();
    expect(await stress.locator("[data-event]").count()).toBeGreaterThan(20);

    await page.getByLabel("Reduced motion").check();
    await expect(stage.locator('[data-slot="time-lens"]')).toHaveAttribute("data-motion", "reduced");
    await expect(stage.locator("[data-event]").first()).toHaveCSS("transition-duration", "0s");
  });

  test("registry item is served with its lib dependency", async ({ request }) => {
    const res = await request.get("/r/time-lens.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain("onWindowCommit");
    expect(item.registryDependencies.some((d: string) => d.endsWith("/r/time-scale.json"))).toBeTruthy();
  });
});
