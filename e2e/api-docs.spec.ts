import { expect, test } from "@playwright/test";
import { mockSession } from "./test-utils";

test.beforeEach(async ({ page }) => {
  await mockSession(page);
});

test("api docs playground runs checks and toggles JSON modes", async ({ page }) => {
  await page.route("**/api/check", async (route) => {
    const requestBody = route.request().postDataJSON() as { url?: unknown } | null;
    const url = requestBody && typeof requestBody.url === "string" ? requestBody.url : "https://example.com";

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "X-RateLimit-Limit": "30",
        "X-RateLimit-Remaining": "29",
        "X-RateLimit-Reset": "1799999999"
      },
      body: JSON.stringify({
        checkedUrl: url,
        finalUrl: `${url.replace(/\/?$/, "/")}`,
        statusCode: 200,
        score: 22,
        grade: "A",
        results: [],
        checkedAt: "2026-03-14T00:00:00.000Z"
      })
    });
  });

  await page.goto("/api-docs");

  const input = page.getByLabel("Target URL");
  await input.fill("https://example.com");
  await input.press("Enter");

  await expect(page.getByText("Last status: 200")).toBeVisible();
  await expect(page.getByText("Rate limit:")).toContainText("29");

  const responseOutput = page.getByLabel("API response output");
  await expect(responseOutput).toContainText('"grade": "A"');

  await page.getByRole("button", { name: "Switch to raw JSON view" }).click();
  await expect(responseOutput).toContainText('"grade":"A"');

  await page.getByRole("button", { name: "Switch to pretty JSON view" }).click();
  await expect(responseOutput).toContainText('"grade": "A"');
});

test("api docs playground shows friendly rate-limit errors", async ({ page }) => {
  await page.route("**/api/check", async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      headers: {
        "X-RateLimit-Limit": "30",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": "1799999999",
        "Retry-After": "10"
      },
      body: JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." })
    });
  });

  await page.goto("/api-docs");
  await page.getByLabel("Target URL").fill("https://example.com");
  await page.getByRole("button", { name: "Run API playground request" }).click();

  await expect(page.getByRole("alert")).toContainText("Rate limit reached. Please wait a moment before trying again.");
  await expect(page.getByText("Rate limit:")).toContainText("0");
});

test("api docs playground remains usable on mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/api-docs");

  await expect(page.getByRole("heading", { name: "Live API Playground" })).toBeVisible();
  await expect(page.getByLabel("Target URL")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run API playground request" })).toBeVisible();
});
