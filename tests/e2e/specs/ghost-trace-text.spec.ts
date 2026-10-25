import { expect, test } from "../fixtures";

test.describe("ghost trace text", () => {
  test("keeps a real heading, traces, and settles", async ({ page }) => {
    await page.goto("/components/ghost-trace-text");
    await expect(page.getByRole("heading", { level: 1, name: "GhostTrace Headline" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const stage = page.getByTestId("playground-stage");
    const heading = stage.getByRole("heading", { name: "Make it move" });
    await expect(heading).toBeVisible();
    const svg = heading.locator("svg");
    await expect(svg).toHaveAttribute("aria-hidden", "true");
    // trigger=mount in the playground: it is tracing or already settled
    await expect(heading).toHaveAttribute("data-state", /tracing|settled/);
    await expect(heading).toHaveAttribute("data-state", "settled", { timeout: 6000 });
    const text = svg.locator('text[data-layer="fill"]').first();
    const fillOpacity = await text.evaluate((el) => getComputedStyle(el).fillOpacity);
    expect(Number(fillOpacity)).toBeGreaterThan(0.95);
    // the SVG sized itself from measured glyphs (not the 1px fallback)
    const box = await svg.boundingBox();
    expect(box!.width).toBeGreaterThan(150);
    expect(box!.height).toBeGreaterThan(30);
  });

  test("reset replays the trace and controls drive the generated code", async ({ page }) => {
    await page.goto("/components/ghost-trace-text");
    const stage = page.getByTestId("playground-stage");
    const code = page.getByTestId("playground-code");
    await page.getByLabel("Text (\\n for lines)").fill("Two\\nlines");
    await expect(stage.locator('svg text[data-layer="ghost"]')).toHaveCount(2);
    await page.getByLabel("Keep stroke").check();
    await expect(code).toContainText("keepStroke");
    await page.getByLabel("Ghost colour", { exact: true }).fill("#ff4d1c");
    await expect(code).toContainText('ghost="#ff4d1c"');
    await expect(stage.locator('svg text[data-layer="ghost"]').first()).toHaveAttribute("stroke", "#ff4d1c");
    await page.getByLabel("Reduced motion").check();
    await expect(stage.locator("svg")).toHaveCount(0);
    await expect(stage.getByRole("heading")).toHaveAttribute("data-motion", "reduced");
    await page.getByLabel("Reduced motion").uncheck();
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(stage.getByRole("heading", { name: "Make it move" })).toHaveAttribute("data-state", /tracing|settled/);
  });

  test("manual example replays on demand", async ({ page }) => {
    await page.goto("/components/ghost-trace-text");
    const ex = page.getByTestId("example-manual");
    const heading = ex.getByRole("heading", { name: "Press play" });
    await ex.scrollIntoViewIfNeeded();
    await expect(heading).toHaveAttribute("data-state", "idle");
    await ex.getByRole("button", { name: "Replay" }).click();
    await expect(heading).toHaveAttribute("data-state", "tracing");
    await expect(heading).toHaveAttribute("data-state", "settled", { timeout: 6000 });
  });

  test("registry item is served", async ({ request }) => {
    const res = await request.get("/r/ghost-trace-text.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain("strokeDashoffset");
  });
});
