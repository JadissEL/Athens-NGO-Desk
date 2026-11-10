// @ts-check
const { test, expect } = require("@playwright/test");

test.describe("Mobile layout", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  async function gotoHash(page, hash) {
    const h = hash.startsWith("#") ? hash : `#${hash}`;
    await page.goto(h, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.NGO_DATA && document.querySelector(".page.active"), null, {
      timeout: 20_000,
    });
  }

  test("guide stepper scrolls and stacks on phone", async ({ page }) => {
    await gotoHash(page, "funding");
    const stepper = page.locator("#page-funding .fund-stepper");
    await expect(stepper).toBeVisible();
    const box = await stepper.boundingBox();
    expect(box).toBeTruthy();
    if (box) expect(box.width).toBeLessThanOrEqual(390);
    await page.locator('[data-fund-step="sources"]').click();
    await expect(page.locator('[data-fund-panel="sources"].is-active')).toBeVisible();
    const aside = page.locator("#page-funding .fund-aside");
    await expect(aside).toBeVisible();
  });

  test("mobile dock reaches Life and More opens search", async ({ page }) => {
    await gotoHash(page, "overview");
    const dock = page.locator("#mobile-dock");
    await expect(dock).toBeVisible();
    await page.locator('#mobile-dock [data-page="life"]').click();
    await expect(page.locator("#page-life.active")).toBeVisible();
    await page.locator("#mobile-dock-more").click();
    await expect(page.locator("#cmd-palette")).toBeVisible();
  });

  test("registry cards single column on phone", async ({ page }) => {
    await gotoHash(page, "registry");
    await expect(page.locator("#reg-card-grid .ngo-card").first()).toBeVisible({ timeout: 15_000 });
    const first = page.locator("#reg-card-grid .ngo-card").first();
    const second = page.locator("#reg-card-grid .ngo-card").nth(1);
    const b1 = await first.boundingBox();
    const b2 = await second.boundingBox();
    if (b1 && b2) {
      expect(b2.y).toBeGreaterThan(b1.y + b1.height - 8);
    }
  });
});
