// @ts-check
const { test, expect } = require("@playwright/test");

async function gotoHash(page, hash) {
  const h = hash.startsWith("#") ? hash : `#${hash}`;
  await page.goto(h, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.NGO_DATA && document.querySelector(".page.active"), null, {
    timeout: 20_000,
  });
}

test.describe("Create & Fund guide wizards", () => {
  test("create deep link opens statute step", async ({ page }) => {
    await gotoHash(page, "create/statute");
    await expect(page.locator("#page-create.active")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-create-panel="statute"].is-active')).toBeVisible();
    await expect(page.locator('[data-create-panel="statute"] h2')).toContainText(/statute/i);
  });

  test("create stepper updates panel and URL", async ({ page }) => {
    await gotoHash(page, "create");
    await page.locator('[data-create-step="somateio"]').click();
    await expect(page).toHaveURL(/#create\/somateio/);
    await expect(page.locator('[data-create-panel="somateio"].is-active')).toBeVisible();
    await expect(page.locator('[data-create-summary="somateio"].is-active')).toBeVisible();
  });

  test("legacy create fragment hash rewrites", async ({ page }) => {
    await gotoHash(page, "create-statute");
    await expect(page).toHaveURL(/#create\/statute/);
    await expect(page.locator("#page-create.active")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-create-panel="statute"].is-active')).toBeVisible();
  });

  test("fund stepper switches readiness panel", async ({ page }) => {
    await gotoHash(page, "funding");
    await page.locator('[data-fund-step="readiness"]').click();
    await expect(page).toHaveURL(/#funding\/readiness/);
    await expect(page.locator('[data-fund-panel="readiness"].is-active')).toBeVisible();
    await expect(page.locator('[data-fund-summary="readiness"].is-active')).toBeVisible();
  });

  test("invalid fund sub-step stays on funding overview", async ({ page }) => {
    await gotoHash(page, "funding/notastep");
    await expect(page.locator("#page-funding.active")).toBeVisible();
    await expect(page.locator('[data-fund-panel="overview"].is-active')).toBeVisible();
  });

  test("possibility rankings step shows cards", async ({ page }) => {
    await gotoHash(page, "possibility/rankings");
    await expect(page.locator("#page-possibility.active")).toBeVisible();
    await expect(page.locator('[data-poss-panel="rankings"].is-active')).toBeVisible();
    await expect(page.locator("#poss-cards .ngo-card").first()).toBeVisible();
  });

  test("audiences groups step", async ({ page }) => {
    await gotoHash(page, "audiences/groups");
    await expect(page.locator("#page-audiences.active")).toBeVisible();
    await expect(page.locator('[data-aud-panel="groups"].is-active')).toBeVisible();
    await expect(page.locator('[data-aud-panel="groups"] h2').first()).toContainText(/Jobseekers/i);
  });

  test("legal terms step", async ({ page }) => {
    await gotoHash(page, "legal/terms");
    await expect(page.locator("#page-legal.active")).toBeVisible();
    await expect(page.locator('[data-legal-panel="terms"].is-active')).toBeVisible();
    await expect(page.locator('[data-legal-panel="terms"] h2').first()).toContainText(/Nature of the service/i);
  });

  test("apply filter narrows contacts", async ({ page }) => {
    await gotoHash(page, "apply");
    await expect(page.locator("#apply-emails .ngo-card").first()).toBeVisible({ timeout: 15_000 });
    const total = await page.locator("#apply-emails .ngo-card").count();
    expect(total).toBeGreaterThan(0);
    await page.locator("#q-apply").fill("zzz-no-match-xyz");
    await expect(page.locator("#apply-emails .ngo-card")).toHaveCount(0);
    await expect(page.locator("#apply-count")).toContainText(/Showing 0 of/);
  });
});
