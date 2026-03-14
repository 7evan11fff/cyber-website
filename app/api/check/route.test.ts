// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetServerSession,
  mockEnforceApiRateLimit,
  mockWithApiRateLimitHeaders,
  mockRunSecurityScan,
  mockGetUserByApiKey,
  mockGetUserKeyFromSessionUser
} = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockEnforceApiRateLimit: vi.fn(),
  mockWithApiRateLimitHeaders: vi.fn((response: Response) => response),
  mockRunSecurityScan: vi.fn(),
  mockGetUserByApiKey: vi.fn(),
  mockGetUserKeyFromSessionUser: vi.fn()
}));

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {}
}));

vi.mock("@/lib/apiRateLimit", () => ({
  enforceApiRateLimit: mockEnforceApiRateLimit,
  withApiRateLimitHeaders: mockWithApiRateLimitHeaders
}));

vi.mock("@/lib/securityReport", () => ({
  runSecurityScan: mockRunSecurityScan
}));

vi.mock("@/lib/userDataStore", () => ({
  getUserByApiKey: mockGetUserByApiKey,
  getUserKeyFromSessionUser: mockGetUserKeyFromSessionUser
}));

import { POST } from "@/app/api/check/route";

describe("POST /api/check", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetServerSession.mockResolvedValue(null);
    mockGetUserKeyFromSessionUser.mockReturnValue(null);
    mockGetUserByApiKey.mockResolvedValue(null);
    mockEnforceApiRateLimit.mockReturnValue({ ok: true, state: { limit: 10, remaining: 9 } });
    mockRunSecurityScan.mockResolvedValue({
      checkedUrl: "https://example.com/",
      finalUrl: "https://example.com/",
      statusCode: 200,
      score: 22,
      grade: "A",
      results: [],
      checkedAt: "2026-03-14T00:00:00.000Z"
    });
  });

  it("returns 422 when request payload is invalid", async () => {
    const response = await POST(
      new Request("http://localhost/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("expected string")
    });
    expect(mockRunSecurityScan).not.toHaveBeenCalled();
  });

  it("returns a scan report for valid input", async () => {
    const response = await POST(
      new Request("http://localhost/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "   example.com   " })
      })
    );

    expect(response.status).toBe(200);
    expect(mockRunSecurityScan).toHaveBeenCalledWith("example.com");
    await expect(response.json()).resolves.toMatchObject({
      checkedUrl: "https://example.com/",
      grade: "A"
    });
  });

  it("returns 401 when provided API key is invalid", async () => {
    const response = await POST(
      new Request("http://localhost/api/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "bad-key"
        },
        body: JSON.stringify({ url: "example.com" })
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid API key." });
    expect(mockRunSecurityScan).not.toHaveBeenCalled();
  });
});
