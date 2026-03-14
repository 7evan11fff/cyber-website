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

  await expect(page.getByText("Overall grade comparison")).toBeVisible();
  await expect(page.getByText("Site A is stronger by 8 points.")).toBeVisible();
  await expect(page.getByText("Score 20/22")).toBeVisible();
  await expect(page.getByText("Score 12/22")).toBeVisible();
  await expect(page.getByRole("region", { name: /Comparison result table/i })).toBeVisible();
});
