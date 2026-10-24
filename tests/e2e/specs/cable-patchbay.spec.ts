import { expect, test } from "../fixtures";

test.describe("cable patchbay", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  test("renders cables for valid edges, lists the invalid one, and connects by two taps", async ({ page }) => {
    await page.goto("/components/cable-patchbay");
    await expect(page.getByRole("heading", { level: 1, name: "Cable Patchbay" })).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const stage = page.getByTestId("playground-stage");
    await page.getByLabel("Host delay (demo)").fill("0");
    await expect(stage.locator("[data-cable]")).toHaveCount(1);
    await expect(stage.getByRole("note")).toContainText("bad: Type mismatch: cv → audio.");
    await stage.getByRole("button", { name: /^Noise out \(/ }).click();
    await expect(stage.locator('[data-slot="cable-patchbay"]')).toHaveAttribute("data-state", "connecting");
    await expect(stage.getByRole("button", { name: /^FX in \(/ })).toHaveAttribute("data-eligible", "true");
    await expect(stage.getByRole("button", { name: /^Amp in \(/ })).toHaveAttribute("data-invalid", "true"); // occupied
    await stage.getByRole("button", { name: /^FX in \(/ }).click();
    const log = stage.getByRole("list", { name: "Event log" });
    await expect(log).toContainText("onConnectRequest(noise → fx, tap)");
    await expect(log).toContainText("host → accepted (connect)");
    await expect(stage.locator("[data-cable]")).toHaveCount(2);
    await expect(stage.getByRole("list", { name: "Connections" })).toContainText("Noise out → FX in");
  });

  test("drag snaps to a compatible socket and shows reasons for invalid ones", async ({ page }) => {
    await page.goto("/components/cable-patchbay");
    const stage = page.getByTestId("playground-stage");
    await page.getByLabel("Host delay (demo)").fill("0");
    const lfo = stage.getByRole("button", { name: /^LFO out \(/ }).locator("[data-socket]");
    const amp = stage.getByRole("button", { name: /^Amp in \(/ }).locator("[data-socket]");
    const cutoff = stage.getByRole("button", { name: /^Cutoff cv \(/ }).locator("[data-socket]");
    const lb = (await lfo.boundingBox())!;
    const ab = (await amp.boundingBox())!;
    const cb = (await cutoff.boundingBox())!;
    await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2);
    await page.mouse.down();
    await page.mouse.move(ab.x + ab.width / 2 + 6, ab.y + ab.height / 2 + 4, { steps: 10 }); // audio input: wrong type
    await expect(stage.locator('[data-slot="cable-patchbay"]')).toHaveAttribute("data-state", "dragging");
    await expect(stage.locator("[data-temp-cable]")).toHaveCount(1);
    await expect(stage.getByRole("status")).toContainText("Cannot connect: Type mismatch: cv → audio.");
    await page.mouse.move(cb.x + cb.width / 2 + 8, cb.y + cb.height / 2 + 6, { steps: 10 }); // within snap radius of Cutoff cv
    await expect(stage.getByRole("button", { name: /^Cutoff cv \(/ })).toHaveAttribute("data-snapped", "true");
    await expect(stage.getByRole("status")).toContainText("Release to connect to Cutoff cv.");
    await page.mouse.up();
    const log = stage.getByRole("list", { name: "Event log" });
    await expect(log).toContainText("onConnectRequest(lfo → cutoff, pointer)");
    await expect(stage.locator("[data-cable]")).toHaveCount(2);
  });

  test("reconnect refusal keeps the original; disconnect and the form work without dragging", async ({ page }) => {
    await page.goto("/components/cable-patchbay");
    const stage = page.getByTestId("playground-stage");
    await page.getByLabel("Preset").selectOption("Refusing host");
    await page.getByLabel("Host delay (demo)").fill("0");
    const list = stage.getByRole("list", { name: "Connections" });
    await list.getByRole("button", { name: "Osc out → Amp in" }).click();
    await stage.getByRole("combobox", { name: "Reconnect to" }).selectOption("fx");
    await stage.getByRole("button", { name: "Reconnect" }).click();
    await expect(stage.getByRole("status")).toContainText("Host refused: reconnect.");
    await expect(list).toContainText("Osc out → Amp in");
    await expect(stage.locator('[data-cable="c1"]')).toHaveCount(1);

    await page.getByLabel("Host refuses (demo)").uncheck();
    await stage.getByRole("combobox", { name: "Source output" }).selectOption("env");
    await stage.getByRole("combobox", { name: "Target input" }).selectOption("gain");
    await stage.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(stage.getByRole("list", { name: "Event log" })).toContainText("onConnectRequest(env → gain, list)");
    await expect(stage.locator("[data-cable]")).toHaveCount(2);
    await stage.getByRole("button", { name: "Disconnect Envelope out from Gain cv" }).click();
    await expect(stage.getByRole("list", { name: "Event log" })).toContainText("onDisconnectRequest");
    await expect(stage.locator("[data-cable]")).toHaveCount(1);
  });

  test("cables stay attached while a containing panel scrolls; reduced motion keeps the workflow", async ({ page }) => {
    await page.goto("/components/cable-patchbay");
    const ex = page.getByTestId("example-scroll");
    const panel = ex.locator("[data-scroll-panel]");
    await panel.scrollIntoViewIfNeeded();
    const cable = ex.locator('[data-cable="c1"] path').first();
    const socket = ex.getByRole("button", { name: /^Amp in \(/ }).locator("[data-socket]");
    await panel.evaluate((el) => {
      el.scrollTop = 120;
    });
    await expect.poll(() => panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    // after scrolling, the cable end still sits on the socket centre (both measured relative to the root)
    const d = (await cable.getAttribute("d"))!;
    const end = d.split(",").pop()!.trim().split(" ").map(Number);
    const sb = (await socket.boundingBox())!;
    const rb = (await ex.locator('[data-slot="cable-patchbay"]').boundingBox())!;
    expect(Math.abs(end[0]! - (sb.x + sb.width / 2 - rb.x))).toBeLessThan(2);
    expect(Math.abs(end[1]! - (sb.y + sb.height / 2 - rb.y))).toBeLessThan(2);

    await page.getByLabel("Reduced motion").check();
    await expect(page.getByTestId("playground-stage").locator('[data-slot="cable-patchbay"]')).toHaveAttribute("data-motion", "reduced");
  });

  test("registry item is served with its lib dependencies", async ({ request }) => {
    const res = await request.get("/r/cable-patchbay.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain("onConnectRequest");
    expect(item.registryDependencies.some((d: string) => d.endsWith("/r/patch-graph.json"))).toBeTruthy();
  });
});
