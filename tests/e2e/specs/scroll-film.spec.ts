import { expect, test } from "@playwright/test";

test.describe("scroll film", () => {
  test("the story example scrubs with scroll, reports times and never plays audio", async ({ page }) => {
    await page.goto("/components/scroll-film");
    await expect(page.getByRole("heading", { level: 1, name: "Scroll Film" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const ex = page.getByTestId("example-story");
    const root = ex.locator('[data-slot="scroll-film"]');
    await expect(root).toHaveAttribute("data-mode", "story");
    await expect(root).toHaveAttribute("data-state", /ready|seeking/, { timeout: 15_000 });
    const video = ex.locator("video");
    expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
    expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    const wrapper = ex.locator("[data-scroll-wrapper]");
    const box = (await wrapper.boundingBox())!;
    const top = box.y + (await page.evaluate(() => window.scrollY));
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "auto" }), top + box.height * 0.5);
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 10_000 }).toBeGreaterThan(3);
    await expect(ex.getByRole("status")).toContainText(/Requested \d+\.\d\d s · presented \d+\.\d\d s/);
    await expect(ex.getByRole("button", { name: /Assembly|Finish/ }).first()).toBeVisible();
    expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  });

  test("Play normally hands control to the native player; chapters seek it; scrolling leaves it alone", async ({ page }) => {
    await page.goto("/components/scroll-film");
    const ex = page.getByTestId("example-native");
    await ex.scrollIntoViewIfNeeded();
    const video = ex.locator("video");
    await expect(video).toHaveAttribute("controls", "");
    await ex.getByRole("button", { name: /Finish/ }).click();
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 10_000 }).toBeGreaterThanOrEqual(8);
    const before = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(300);
    expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBe(before);
  });

  test("a failed URL keeps poster, transcript and chapters; reduced motion exposes the native player", async ({ page }) => {
    await page.goto("/components/scroll-film");
    const failed = page.getByTestId("example-failed");
    await failed.scrollIntoViewIfNeeded();
    await expect(failed.getByRole("alert")).toContainText("could not be loaded", { timeout: 15_000 });
    await expect(failed.locator('[data-slot="scroll-film"]')).toHaveAttribute("data-state", "fallback");
    await expect(failed.getByText(/The speaker arrives in two boxes/)).toBeVisible();
    await expect(failed.getByRole("navigation", { name: "Chapters" }).getByRole("button")).toHaveCount(3);

    await page.getByLabel("Reduced motion").check();
    const stage = page.getByTestId("playground-stage");
    await expect(stage.locator('[data-slot="scroll-film"]')).toHaveAttribute("data-mode", "native");
    await expect(stage.locator("video")).toHaveAttribute("controls", "");
    await expect(stage.getByText(/The baffle slides onto the cabinet/)).toBeVisible();
  });

  test("registry item is served with its lib dependency and the film fixture exists", async ({ request }) => {
    const res = await request.get("/r/scroll-film.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain("createSeekScheduler");
    expect(item.registryDependencies.some((d: string) => d.endsWith("/r/seek-scheduler.json"))).toBeTruthy();
    const film = await request.get("/media/film.webm");
    expect(film.ok()).toBeTruthy();
  });
});
