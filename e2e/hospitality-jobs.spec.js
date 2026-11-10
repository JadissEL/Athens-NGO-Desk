// @ts-check
const { test, expect } = require("@playwright/test");

const MOCK_JOB = {
  id: "mock_job_1",
  title: "Test housekeeping role",
  description: "Seasonal test role for Playwright.",
  location: "Athens, Attica",
  contractType: "seasonal",
  languagesRequired: ["Greek"],
  languagesPreferred: ["English"],
  fairHireFlags: { trainingProvided: true, noExperienceRequired: true },
  publishedAt: "2026-11-01T12:00:00.000Z",
  closesAt: null,
  employerDisplayName: "Mock Aegean Hotel",
  employerSlug: "mock-aegean",
  employerType: "hotel",
  employerRegion: "Attica",
};

async function gotoHash(page, hash) {
  const h = hash.startsWith("#") ? hash : `#${hash}`;
  await page.goto(h, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.NGO_DATA && document.querySelector(".page.active"), null, {
    timeout: 20_000,
  });
}

test.describe("Hospitality jobs lane", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/hospitality/jobs", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [MOCK_JOB] }),
      });
    });
    await page.route("**/api/hospitality/applications", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        if (!body.gdprConsent) {
          return route.fulfill({ status: 400, body: JSON.stringify({ error: "consent" }) });
        }
        return route.fulfill({ status: 200, body: JSON.stringify({ ok: true, applicationId: "app1" }) });
      }
      return route.continue();
    });
  });

  test("jobs source filter and portal apply form", async ({ page }) => {
    await gotoHash(page, "jobs");
    await page.selectOption("#f-jobs-source", "hospitality");
    await expect(page.locator("#jobs-result-count")).toContainText(/1 opening/i);
    await expect(page.locator(".job-card")).toContainText(/Mock Aegean Hotel/i);

    const details = page.locator(".job-card .btn").first();
    await details.click();

    const pane = page.locator("#job-pane-portal-apply, #job-drawer-portal-apply");
    await expect(pane).toBeVisible({ timeout: 10_000 });
    await expect(pane).toContainText(/Apply on this desk/i);

    await pane.locator('input[name="seekerName"]').fill("Test Seeker");
    await pane.locator('input[name="seekerEmail"]').fill("seeker@example.com");
    await pane.locator('input[name="gdprConsent"]').check();
    await pane.locator('button[type="submit"]').click();
    await expect(pane.locator(".apply-status.is-ok")).toContainText(/Application sent/i, { timeout: 15_000 });
  });

  test("employer page loads workbench", async ({ page }) => {
    await page.route("**/api/steward-config", (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ clerkPublishableKey: "", clerkServerConfigured: false }),
      });
    });
    await gotoHash(page, "employer");
    await expect(page.locator("#page-employer.active")).toBeVisible();
    await expect(page.locator("#page-employer .fund-wizard-title")).toContainText(/hospitality role/i);
  });
});
