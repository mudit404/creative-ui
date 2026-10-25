import { expect, test, type Page } from "../fixtures";

/**
 * The developer journey from the product brief, end to end:
 * open the site → discover → interact → customise in the playground →
 * copy working code → the registry item is served.
 */

async function hoverNear(page: Page, selector: string, dx: number, dy: number) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 12 });
}

test.describe("landing", () => {
  test("renders the hero with a live Material Button and the install command", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("behave like");
    await expect(page.getByRole("link", { name: "Try the Material Button" })).toBeVisible();
    await expect(page.getByText("npx shadcn@latest add")).toBeVisible();
    // the hero stage hosts the real component with its goo canvas
    const stage = page
      .locator('[data-slot="material-button"]')
      .filter({ hasText: "Let’s collaborate" })
      .first();
    await expect(stage).toBeVisible();
    await expect(stage.locator("canvas")).toHaveCount(1);
  });

  test("has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.goto("/components/material-button");
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });
});

test.describe("discovery", () => {
  test("explorer searches and filters the catalog", async ({ page }) => {
    await page.goto("/components");
    const cards = page.getByTestId("component-card");
    await expect(cards.first()).toBeVisible();
    const total = await cards.count();
    expect(total).toBeGreaterThanOrEqual(10);
    await page.getByTestId("explorer-search").fill("symbiote");
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Material Button");
    await page.getByTestId("explorer-search").fill("");
    await page.getByRole("button", { name: "Navigation" }).click();
    await expect(cards.first()).toContainText("Rail");
    await page.getByRole("button", { name: "All" }).click();
    // status filter: every card currently carries a status; the filter must partition the catalog
    const byStatus = async (s: string) =>
      page.locator(`[data-testid="component-card"][data-status="${s}"]`).count();
    const planned = await byStatus("planned");
    const experimental = await byStatus("experimental");
    const stable = await byStatus("stable");
    expect(planned + experimental + stable).toBe(total);
    await page.getByLabel("Status").selectOption("experimental");
    await expect(cards).toHaveCount(experimental);
    await page.getByLabel("Status").selectOption("planned");
    await expect(cards).toHaveCount(planned);
    await page.getByLabel("Tier").selectOption("premium");
    await page.getByLabel("Status").selectOption("all");
    const premium = await cards.count();
    expect(premium).toBeGreaterThan(0);
    expect(premium).toBeLessThan(total);
  });

  test("command palette jumps to a component", async ({ page }) => {
    await page.goto("/docs");
    await page.keyboard.press("ControlOrMeta+k");
    const box = page.getByRole("combobox");
    await expect(box).toBeFocused();
    await box.fill("material");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/components\/material-button$/);
  });
});

test.describe("component page", () => {
  test("documents the component fully", async ({ page }) => {
    await page.goto("/components/material-button");
    await expect(page.getByRole("heading", { level: 1, name: "Material Button" })).toBeVisible();
    for (const id of [
      "playground",
      "examples",
      "installation",
      "api",
      "css-variables",
      "accessibility",
      "performance",
      "limitations",
      "source",
      "provenance",
    ]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    // API table lists the props
    await expect(page.locator("#api table")).toContainText("tendrils");
    // source view shows the real file
    await expect(page.locator("#source")).toContainText("export const MaterialButton");
    // every example has a live renderer
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);
    await expect(
      page.getByTestId("example-link").getByRole("link", { name: "See pricing" }),
    ).toBeVisible();
  });

  test("reaches for the pointer and lets go", async ({ page }) => {
    await page.goto("/components/material-button");
    const stage = page.getByTestId("playground-stage");
    const btn = stage.getByRole("button", { name: "Let’s collaborate" });
    await expect(btn).toBeVisible();
    const canvas = stage.locator("canvas");
    await expect(canvas).toHaveCount(1);
    // move the pointer to within reach above the button and wait for strands
    const pixels = () =>
      canvas.evaluate((c: HTMLCanvasElement) => {
        const ctx = c.getContext("2d")!;
        const { data } = ctx.getImageData(0, 0, c.width, c.height);
        let n = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) n++;
        return n;
      });
    await hoverNear(page, '[data-testid="playground-stage"] button', 0, -70);
    // strands are simulated per animation frame; poll rather than assume how many frames 600 ms buys on this machine
    let drawn = 0;
    await expect.poll(async () => (drawn = await pixels()), { timeout: 5000 }).toBeGreaterThan(200);
    // pull far away: strands snap and the canvas clears
    await page.mouse.move(5, 5, { steps: 10 });
    await expect.poll(pixels, { timeout: 5000 }).toBeLessThan(drawn);
  });

  test("is keyboard operable", async ({ page }) => {
    await page.goto("/components/material-button");
    const btn = page
      .getByTestId("playground-stage")
      .getByRole("button", { name: "Let’s collaborate" });
    await btn.focus();
    await expect(btn).toBeFocused();
    await page.evaluate(() => {
      const w = window as unknown as { __clicks: number };
      w.__clicks = 0;
      document
        .querySelector('[data-testid="playground-stage"] button')!
        .addEventListener("click", () => (w.__clicks += 1));
    });
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __clicks: number }).__clicks))
      .toBe(2);
    // a visible focus ring for keyboard focus
    const ring = await btn.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(ring).not.toBe("none");
  });
});

test.describe("playground", () => {
  test("controls update the real component and the generated code", async ({ page }) => {
    await page.goto("/components/material-button");
    const stage = page.getByTestId("playground-stage");
    const code = page.getByTestId("playground-code");
    const btn = stage.getByRole("button");

    await page.getByLabel("Label", { exact: true }).fill("Ship it");
    await expect(stage.getByRole("button", { name: "Ship it" })).toBeVisible();
    await expect(code).toContainText("Ship it");

    await page.getByLabel("Size").selectOption("sm");
    await expect(btn).toHaveClass(/h-9/);
    await expect(code).toContainText('size="sm"');

    await page.getByLabel("Tone").selectOption("bone");
    await expect(stage.locator('[data-slot="material-button"]')).toHaveAttribute(
      "data-tone",
      "bone",
    );
    await expect(code).toContainText('tone="bone"');

    await page.getByLabel("Loading", { exact: true }).check();
    await expect(btn).toHaveAttribute("aria-busy", "true");
    await expect(code).toContainText("loading");

    await page.getByLabel("Loading", { exact: true }).uncheck();
    await page.getByLabel("Surface colour", { exact: true }).fill("#1d2a6b");
    await expect(stage.locator('[data-slot="material-button"]')).toHaveAttribute(
      "style",
      /--mb-surface:\s*#1d2a6b/,
    );
    await expect(code).toContainText('colors={{ surface: "#1d2a6b" }}');

    // reduced-motion simulation removes the canvas
    await page.getByLabel("Reduced motion").check();
    await expect(stage.locator("canvas")).toHaveCount(0);
    await expect(code).toContainText('motion="reduced"');
    await page.getByLabel("Reduced motion").uncheck();
    await expect(stage.locator("canvas")).toHaveCount(1);

    // dark preview environment
    await page.getByRole("radio", { name: "Dark" }).click();
    await expect(stage).toHaveAttribute("data-surface", "dark");

    // reset restores defaults
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(stage.getByRole("button", { name: "Let’s collaborate" })).toBeVisible();
    await expect(code).not.toContainText('size="sm"');
  });

  test("presets apply and copy puts valid code on the clipboard", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "clipboard permissions are chromium-only in CI");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/components/material-button");
    await page.getByLabel("Preset").selectOption("Calm");
    const code = page.getByTestId("playground-code");
    await expect(code).toContainText("reach={70}");
    await page.getByRole("button", { name: "Copy code" }).click();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('import { MaterialButton } from "@/components/ui/material-button"');
    expect(text).toContain("reach={70}");
    expect(text).toContain("tendrils={3}");
    expect(text).toContain("idle={false}");
    expect(text).toMatch(/<MaterialButton[\s\S]*>\s*Let’s collaborate\s*<\/MaterialButton>/);
  });
});

test.describe("registry", () => {
  test("serves a valid shadcn registry item with resolvable dependencies", async ({
    request,
    baseURL,
  }) => {
    const index = await request.get("/r/registry.json");
    expect(index.ok()).toBeTruthy();
    const idx = await index.json();
    expect(idx.items.map((i: { name: string }) => i.name)).toContain("material-button");

    const res = await request.get("/r/material-button.json");
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["access-control-allow-origin"]).toBe("*");
    const item = await res.json();
    expect(item.type).toBe("registry:ui");
    expect(item.files[0].path).toBe("components/ui/material-button.tsx");
    expect(item.files[0].content).toContain("export const MaterialButton");
    expect(item.dependencies).toEqual(expect.arrayContaining(["motion", "@radix-ui/react-slot"]));
    // every URL dependency resolves
    for (const dep of item.registryDependencies as string[]) {
      if (!dep.startsWith("http")) continue;
      const url = dep.replace(/^https?:\/\/[^/]+/, baseURL!);
      const d = await request.get(url);
      expect(d.ok(), dep).toBeTruthy();
    }
  });
});
