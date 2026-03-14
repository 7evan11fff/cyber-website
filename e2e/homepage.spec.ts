import { expect, test } from "@playwright/test";
import { buildMockReport, mockCheckEndpoint, mockSession } from "./test-utils";

test.beforeEach(async ({ page }) => {
  await mockSession(page);
  await mockCheckEndpoint(page, (input) => buildMockReport(input, { grade: "A", score: 22 }));
});

test("homepage scan flow displays report results", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("textbox", { name: "Website URL to scan", exact: true }).fill("example.com");
  await page.getByRole("button", { name: "Check", exact: true }).click();

  await expect(page.getByText("Overall Grade")).toBeVisible();
  await expect(page.getByText(/Checked URL:\s*https:\/\/example\.com\//)).toBeVisible();
  await expect(page.getByText(/Final URL:\s*https:\/\/example\.com\//)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Content-Security-Policy" })).toBeVisible();
});

test("header deep-dive modal and keyboard shortcuts work", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("textbox", { name: "Website URL to scan", exact: true }).fill("example.com");
  await page.getByRole("button", { name: "Check", exact: true }).click();

  await page.getByRole("button", { name: "Open deep dive for Content-Security-Policy" }).click();
  await expect(page.getByRole("dialog", { name: "Content-Security-Policy" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Read on MDN" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Content-Security-Policy" })).toHaveCount(0);

  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toHaveCount(0);

  await page.keyboard.press("2");
  await expect(page.locator("#header-card-single-strict-transport-security")).toBeFocused();
});
