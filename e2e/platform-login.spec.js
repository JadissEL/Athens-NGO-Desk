// @ts-check
const { test, expect } = require("@playwright/test");

test.describe("Platform account hub", () => {
  test("account page and sign-in control exist", async ({ page }) => {
    await page.goto("/#account");
    await expect(page.locator("#page-account .fund-wizard-title")).toContainText("Sign in");
    await expect(page.locator("#desk-auth-btn")).toBeVisible();
    await expect(page.locator("#account-dashboard-type")).toBeAttached();
  });
});
