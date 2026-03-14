import { expect, test } from "@playwright/test";

test("webhook test endpoint requires authentication", async ({ request }) => {
  const response = await request.post("/api/webhooks/test", {
    data: {
      url: "https://hooks.example.com/security"
    }
  });

  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
  await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
});

test("webhook list endpoint requires authentication", async ({ request }) => {
  const response = await request.get("/api/webhooks");

  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
  await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
});
