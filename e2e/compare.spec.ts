import { expect, test } from "@playwright/test";
import { buildMockReport, mockCheckEndpoint, mockSession } from "./test-utils";

test.beforeEach(async ({ page }) => {
  await mockSession(page);
  await mockCheckEndpoint(page, (input) => {
    const report = input.includes("site-b")
      ? buildMockReport(input, { grade: "C", score: 12 })
      : buildMockReport(input, { grade: "A", score: 20 });

    return report;
  });
});

test("compare page displays side-by-side results", async ({ page }) => {
  await page.goto("/compare");

  await page.getByLabel("Site A URL").fill("site-a.example");
  await page.getByLabel("Site B URL").fill("site-b.example");
  await page.getByRole("button", { name: "Compare security headers for both URLs" }).click();

  await expect(page.getByText("Comparison summary")).toBeVisible();
  await expect(page.getByText("is more secure by 8 points.")).toBeVisible();
  await expect(page.getByText("Score 20/22")).toBeVisible();
  await expect(page.getByText("Score 12/22")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy shareable comparison link" })).toBeVisible();
  await expect(page.getByRole("region", { name: /Comparison result table/i })).toBeVisible();
});

test("comparison page loads and runs from share link query", async ({ page }) => {
  await page.goto("/compare?sites=site-a.example,site-b.example");

  await expect(page.getByLabel("Site A URL")).toHaveValue("site-a.example");
  await expect(page.getByLabel("Site B URL")).toHaveValue("site-b.example");
  await expect(page.getByText("Comparison summary")).toBeVisible();
  await expect(page.getByText("Winner: site-a.example")).toBeVisible();
});
