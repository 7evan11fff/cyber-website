import { expect, test } from "@playwright/test";
import { buildMockReport, mockCheckEndpoint, mockSession, mockShareEndpoint } from "./test-utils";

test.beforeEach(async ({ page }) => {
  await mockSession(page);
  await mockShareEndpoint(page);
  await mockCheckEndpoint(page, (input) => {
    const isSecondSite = input.includes("site-b");
    return buildMockReport(input, {
      grade: isSecondSite ? "C" : "A",
      score: isSecondSite ? 14 : 22
    });
  });
});

test("bulk scan page scans multiple URLs and renders rows", async ({ page }) => {
  await page.goto("/bulk");

  await page.getByLabel("URLs (one per line)").fill("site-a.example\nsite-b.example");
  await page.getByRole("button", { name: "Scan All" }).click();

  await expect(page.getByText("Showing 2 of 2 rows")).toBeVisible();
  await expect(page.locator("table tbody").getByText("site-a.example", { exact: true })).toBeVisible();
  await expect(page.locator("table tbody").getByText("site-b.example", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open full report for/i })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
});
