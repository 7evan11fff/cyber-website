// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetServerSession,
  mockEnforceApiRateLimit,
  mockWithApiRateLimitHeaders,
  mockRunSecurityScan,
  mockGetUserByApiKey,
  mockGetUserKeyFromSessionUser,
  mockSentryCaptureException,
  mockRecordPublicScan
} = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockEnforceApiRateLimit: vi.fn(),
  mockWithApiRateLimitHeaders: vi.fn((response: Response) => response),
  mockRunSecurityScan: vi.fn(),
  mockGetUserByApiKey: vi.fn(),
  mockGetUserKeyFromSessionUser: vi.fn(),
  mockSentryCaptureException: vi.fn(),
  mockRecordPublicScan: vi.fn()
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

vi.mock("@/lib/publicStatsStore", () => ({
  recordPublicScan: mockRecordPublicScan
}));

vi.mock("@/lib/userDataStore", () => ({
  getUserByApiKey: mockGetUserByApiKey,
  getUserKeyFromSessionUser: mockGetUserKeyFromSessionUser
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: mockSentryCaptureException
}));

import { OPTIONS, POST } from "@/app/api/check/route";

describe("POST /api/check", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetServerSession.mockResolvedValue(null);
    mockGetUserKeyFromSessionUser.mockReturnValue(null);
    mockGetUserByApiKey.mockResolvedValue(null);
    mockEnforceApiRateLimit.mockReturnValue({ ok: true, state: { limit: 10, remaining: 9 } });
    mockRecordPublicScan.mockResolvedValue(undefined);
    mockRunSecurityScan.mockResolvedValue({
      checkedUrl: "https://example.com/",
      finalUrl: "https://example.com/",
      statusCode: 200,
      score: 22,
      grade: "A",
      results: [],
      checkedAt: "2026-03-14T00:00:00.000Z",
      framework: {
        server: "nginx",
        poweredBy: null,
        detected: {
          id: "nginx",
          label: "Nginx",
          reason: "Detected from Server response header.",
          evidence: [{ header: "server", value: "nginx" }]
        }
      }
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
    expect(mockRunSecurityScan).toHaveBeenCalledWith("example.com", undefined);
    expect(mockRecordPublicScan).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      checkedUrl: "https://example.com/",
      grade: "A"
    });
  });

  it("passes advanced scan options through to the scanner", async () => {
    const response = await POST(
      new Request("http://localhost/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "example.com",
          options: {
            userAgent: "Mozilla/5.0 Test Agent",
            followRedirects: false,
            timeoutMs: 5000
          }
        })
      })
    );

    expect(response.status).toBe(200);
    expect(mockRunSecurityScan).toHaveBeenCalledWith("example.com", {
      userAgent: "Mozilla/5.0 Test Agent",
      followRedirects: false,
      timeoutMs: 5000
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
    await expect(response.json()).resolves.toMatchObject({
      error: "API key not recognized. Double-check the key and try again."
    });
    expect(mockGetUserByApiKey).toHaveBeenCalledWith("bad-key");
    expect(mockRunSecurityScan).not.toHaveBeenCalled();
  });

  it("returns a friendly error when domain is unreachable", async () => {
    mockRunSecurityScan.mockRejectedValueOnce(new TypeError("fetch failed"));

    const response = await POST(
      new Request("http://localhost/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "example.com" })
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "We couldn't reach that domain. Check the URL and confirm the site is online, then try again."
    });
    expect(mockSentryCaptureException).toHaveBeenCalledTimes(1);
  });

  it("authenticates with Bearer API key and applies elevated limits", async () => {
    mockGetUserByApiKey.mockResolvedValueOnce({
      userKey: "ci@example.com",
      data: {}
    });

    const response = await POST(
      new Request("http://localhost/api/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer shc_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        },
        body: JSON.stringify({ url: "example.com" })
      })
    );

    expect(response.status).toBe(200);
    expect(mockGetUserByApiKey).toHaveBeenCalledWith(
      "shc_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
    expect(mockEnforceApiRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "check",
        authenticatedLimit: 300,
        identity: expect.objectContaining({
          isAuthenticated: true,
          userKey: "ci@example.com"
        })
      })
    );
  });

  it("accepts x-api-key header for API key authentication", async () => {
    mockGetUserByApiKey.mockResolvedValueOnce({
      userKey: "automation@example.com",
      data: {}
    });

    const response = await POST(
      new Request("http://localhost/api/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "shc_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        },
        body: JSON.stringify({ url: "example.com" })
      })
    );

    expect(response.status).toBe(200);
    expect(mockGetUserByApiKey).toHaveBeenCalledWith(
      "shc_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    );
    expect(mockRunSecurityScan).toHaveBeenCalledWith("example.com", undefined);
  });

  it("responds to CORS preflight requests for extension origins", async () => {
    const response = await OPTIONS(
      new Request("http://localhost/api/check", {
        method: "OPTIONS",
        headers: {
          Origin: "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
          "Access-Control-Request-Method": "POST"
        }
      })
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "chrome-extension://abcdefghijklmnopabcdefghijklmnop"
    );
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
  });
});
