// @ts-check
const { test, expect } = require("@playwright/test");

const MOCK_EVENTS = {
  items: [
    {
      id: "evt_mock_1",
      title: "Mock advocacy forum",
      description: "Playwright fixture event.",
      startsAt: new Date(Date.now() + 5 * 86400000).toISOString(),
      endsAt: null,
      timezone: "Europe/Athens",
      location: "Athens",
      isOnline: false,
      hostOrgIds: [],
      hostOrgNames: ["Demo NGO"],
      tags: [],
      source: "steward",
      sourceUrl: null,
      publishedAt: new Date().toISOString(),
    },
  ],
};

async function gotoHash(page, hash) {
  const h = hash.startsWith("#") ? hash : `#${hash}`;
  await page.goto(h, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.NGO_DATA && document.querySelector(".page.active"), null, {
    timeout: 20_000,
  });
}

test.describe("Civic events lane", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/events", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_EVENTS),
      });
    });
    await page.route("**/api/events/*/threads", async (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 200,
          body: JSON.stringify({ ok: true, thread: { id: "thread1", subject: "Co-host" } }),
        });
      }
      return route.continue();
    });
  });

  test("events page lists mocked calendar item", async ({ page }) => {
    await gotoHash(page, "events");
    await expect(page.locator("#page-events.active")).toBeVisible();
    await expect(page.locator("#events-result-count")).toContainText(/1 event/i);
    await expect(page.locator(".event-card")).toContainText(/Mock advocacy forum/i);
    await page.locator(".event-card button").first().click();
    await expect(page.locator("#event-pane-title")).toContainText(/Mock advocacy forum/i);
    await expect(page.locator("#event-pane-collab")).toBeVisible();
  });
});
