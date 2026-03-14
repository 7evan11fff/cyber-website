import { expect, test } from "@playwright/test";
import { buildMockReport, mockCheckEndpoint, mockSession } from "./test-utils";

test.beforeEach(async ({ page }) => {
  await mockSession(page);
  await mockCheckEndpoint(page, (input) => buildMockReport(input));
});

test("theme toggle switches between light and dark", async ({ page }) => {
  await page.goto("/");

  const toggleToLight = page.getByRole("button", { name: "Switch to light theme" }).first();
  if (await toggleToLight.isVisible()) {
    await toggleToLight.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "Switch to dark theme" }).first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  } else {
    const toggleToDark = page.getByRole("button", { name: "Switch to dark theme" }).first();
    await toggleToDark.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Switch to light theme" }).first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  }
});

test("mobile navigation is usable on small viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const menuButton = page.getByRole("button", { name: "Open navigation menu" });
  await expect(menuButton).toBeVisible();
  await menuButton.click();

  await expect(page.getByRole("link", { name: "Compare" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bulk" })).toBeVisible();
});
