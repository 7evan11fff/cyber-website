// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockResolveTeamRequestIdentity,
  mockEnforceApiRateLimit,
  mockWithApiRateLimitHeaders,
  mockHasTeamAccess,
  mockAcceptTeamInvite
} = vi.hoisted(() => ({
  mockResolveTeamRequestIdentity: vi.fn(),
  mockEnforceApiRateLimit: vi.fn(),
  mockWithApiRateLimitHeaders: vi.fn((response: Response) => response),
  mockHasTeamAccess: vi.fn(),
  mockAcceptTeamInvite: vi.fn()
}));

vi.mock("@/lib/teamRequestIdentity", () => ({
  resolveTeamRequestIdentity: mockResolveTeamRequestIdentity
}));

vi.mock("@/lib/apiRateLimit", () => ({
  enforceApiRateLimit: mockEnforceApiRateLimit,
  withApiRateLimitHeaders: mockWithApiRateLimitHeaders
}));

vi.mock("@/lib/teamAccess", () => ({
  hasTeamAccess: mockHasTeamAccess
}));

vi.mock("@/lib/teamDataStore", () => ({
  acceptTeamInvite: mockAcceptTeamInvite
}));

import { POST } from "@/app/api/team-invites/[token]/accept/route";

describe("team invite acceptance route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveTeamRequestIdentity.mockResolvedValue({
      userKey: "member@example.com",
      userEmail: "member@example.com",
      sessionUser: { email: "member@example.com" }
    });
    mockEnforceApiRateLimit.mockReturnValue({
      ok: true,
      state: { limit: 100, remaining: 99, resetAt: Date.now() + 60_000 }
    });
    mockHasTeamAccess.mockReturnValue(true);
    mockAcceptTeamInvite.mockResolvedValue({ ok: true, teamSlug: "acme-team" });
  });

  it("accepts invite token for authenticated user", async () => {
    const response = await POST(new Request("http://localhost/api/team-invites/token/accept"), {
      params: { token: "invite-token" }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      teamSlug: "acme-team"
    });
    expect(mockAcceptTeamInvite).toHaveBeenCalledWith({
      token: "invite-token",
      acceptingUserId: "member@example.com",
      acceptingEmail: "member@example.com"
    });
  });

  it("returns error when invite token is expired", async () => {
    mockAcceptTeamInvite.mockResolvedValueOnce({ ok: false, reason: "expired" });

    const response = await POST(new Request("http://localhost/api/team-invites/token/accept"), {
      params: { token: "expired-token" }
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "This invite link has expired."
    });
  });

  it("requires authenticated session email", async () => {
    mockResolveTeamRequestIdentity.mockResolvedValueOnce({
      userKey: "no-email-user",
      userEmail: null,
      sessionUser: { name: "No Email User" }
    });

    const response = await POST(new Request("http://localhost/api/team-invites/token/accept"), {
      params: { token: "invite-token" }
    });

    expect(response.status).toBe(401);
    expect(mockAcceptTeamInvite).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    mockEnforceApiRateLimit.mockReturnValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 })
    });
    const response = await POST(new Request("http://localhost/api/team-invites/token/accept"), {
      params: { token: "invite-token" }
    });
    expect(response.status).toBe(429);
    expect(mockAcceptTeamInvite).not.toHaveBeenCalled();
  });
});
