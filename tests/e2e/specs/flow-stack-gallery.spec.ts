import { expect, test } from "../fixtures";

test.describe("flow stack gallery", () => {
  test("thumbnails fly into the viewer, controls shuffle the deck, keyboard works", async ({
    page,
  }) => {
    await page.goto("/components/flow-stack-gallery");
    await expect(
      page.getByRole("heading", { level: 1, name: "ThumbnailFlow Gallery" }),
    ).toBeVisible();
    await expect(page.getByText("Example renderer missing")).toHaveCount(0);

    const stage = page.getByTestId("playground-stage");
    const gallery = stage.getByRole("group", { name: "Lookbook" });
    const panel = gallery.getByRole("tabpanel");
    // while a card exits it keeps data-offset="0"; wait for a single top card before reading it
    const top = () => panel.locator('[data-offset="0"] img');
    const expectTop = async (alt: RegExp) => {
      await expect(panel.locator('[data-offset="0"]')).toHaveCount(1);
      await expect(top()).toHaveAttribute("alt", alt);
    };
    await expectTop(/Harbour/);
    await expect(gallery.getByRole("tab")).toHaveCount(7);

    // click a thumbnail: a flight appears, then the top image is the new one
    await gallery.getByRole("tab", { name: /Night bus/ }).click();
    await expect(gallery.locator('[data-slot="flow-stack-flight"]')).toHaveCount(1);
    await expect(gallery).toHaveAttribute("data-index", "2");
    await expect(gallery.locator('[data-slot="flow-stack-flight"]')).toHaveCount(0, {
      timeout: 4000,
    });
    await expectTop(/Night bus/);
    await expect(panel.locator('[data-offset="0"]')).toHaveCSS("opacity", "1");
    await expect(gallery.getByRole("tab", { name: /Night bus/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // next / previous
    await gallery.getByRole("button", { name: "Next image" }).click();
    await expectTop(/Tide tables/);
    await gallery.getByRole("button", { name: "Previous image" }).click();
    await expectTop(/Night bus/);

    // keyboard on the strip
    await gallery.getByRole("tab", { name: /Night bus/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(gallery.getByRole("tab", { name: /Tide tables/ })).toBeFocused();
    await expect(gallery).toHaveAttribute("data-index", "3");
    await page.keyboard.press("Home");
    await expect(gallery).toHaveAttribute("data-index", "0");
    await expect(gallery.getByText("Image 1 of 7")).toBeAttached();
  });

  test("dragging the top card moves through the deck", async ({ page }) => {
    await page.goto("/components/flow-stack-gallery");
    const stage = page.getByTestId("playground-stage");
    const gallery = stage.getByRole("group", { name: "Lookbook" });
    const card = gallery.locator('[data-offset="0"]');
    await card.scrollIntoViewIfNeeded();
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++)
      await page.mouse.move(box.x + box.width / 2 - i * 20, box.y + box.height / 2);
    await page.mouse.up();
    await expect(gallery).toHaveAttribute("data-index", "1");
    await expect(gallery.locator('[data-offset="0"]')).toHaveCount(1);
    await expect(gallery.locator('[data-offset="0"] img')).toHaveAttribute("alt", /Dunes/);
  });

  test("playground controls and reduced motion", async ({ page }) => {
    await page.goto("/components/flow-stack-gallery");
    const stage = page.getByTestId("playground-stage");
    const gallery = stage.getByRole("group", { name: "Lookbook" });
    await page.getByRole("slider", { name: "Stack depth" }).fill("1");
    await expect(gallery.locator("[data-offset]")).toHaveCount(2);
    await page.getByLabel("Loop").uncheck();
    await expect(gallery.getByRole("button", { name: "Previous image" })).toBeDisabled();
    await expect(page.getByTestId("playground-code")).toContainText("loop={false}");
    await page.getByLabel("Reduced motion").check();
    await expect(gallery).toHaveAttribute("data-motion", "reduced");
    await gallery.getByRole("tab", { name: /Dunes/ }).click();
    await expect(gallery.locator('[data-slot="flow-stack-flight"]')).toHaveCount(0);
    await expect(gallery).toHaveAttribute("data-index", "1");
  });

  test("registry item is served", async ({ request }) => {
    const res = await request.get("/r/flow-stack-gallery.json");
    expect(res.ok()).toBeTruthy();
    const item = await res.json();
    expect(item.files[0].content).toContain('role="tablist"');
    expect(item.meta.tier).toBe("premium");
  });
});
