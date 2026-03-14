import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildWebhookRequestBody,
  detectWebhookKind,
  sendGradeChangeWebhook
} from "@/lib/webhookDelivery";

describe("webhookDelivery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects Slack webhook URLs", () => {
    expect(detectWebhookKind("https://hooks.slack.com/services/T000/B000/XXXX")).toBe("slack");
  });

  it("detects Discord webhook URLs", () => {
    expect(detectWebhookKind("https://discord.com/api/webhooks/123/abc")).toBe("discord");
  });

  it("falls back to generic webhook format", () => {
    expect(detectWebhookKind("https://hooks.example.com/security-events")).toBe("generic");
  });

  it("builds generic payloads with old/new grade fields", () => {
    const payload = buildWebhookRequestBody("generic", {
      domain: "example.com",
      oldGrade: "a",
      newGrade: "c",
      timestamp: "2026-03-14T00:00:00.000Z"
    }) as Record<string, unknown>;

    expect(payload.oldGrade).toBe("A");
    expect(payload.newGrade).toBe("C");
    expect(payload.previousGrade).toBe("A");
    expect(payload.currentGrade).toBe("C");
  });

  it("sends Slack payloads to Slack webhook URLs", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));

    const result = await sendGradeChangeWebhook("https://hooks.slack.com/services/T000/B000/XXXX", {
      domain: "example.com",
      oldGrade: "B",
      newGrade: "A",
      timestamp: "2026-03-14T00:00:00.000Z",
      checkedUrl: "https://example.com/"
    });

    expect(result.kind).toBe("slack");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/T000/B000/XXXX",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json"
        }),
        body: expect.any(String)
      })
    );

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.text).toEqual(expect.stringContaining("Security Header grade change"));
  });
});
