import { expect, test } from "@playwright/test";
import { buildMockReport, mockCheckEndpoint, mockSession } from "./test-utils";

test.beforeEach(async ({ page }) => {
  await mockSession(page);
  await mockCheckEndpoint(page, (input) => buildMockReport(input, { grade: "A", score: 22 }));
});

test("homepage scan flow displays report results", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Website URL to scan").fill("example.com");
  await page.getByRole("button", { name: "Check", exact: true }).click();

  await expect(page.getByText("Overall Grade")).toBeVisible();
  await expect(page.getByText(/Checked URL:\s*https:\/\/example\.com\//)).toBeVisible();
  await expect(page.getByText(/Final URL:\s*https:\/\/example\.com\//)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Content-Security-Policy" })).toBeVisible();
});
