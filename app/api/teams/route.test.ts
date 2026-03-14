// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockResolveTeamRequestIdentity,
  mockEnforceApiRateLimit,
  mockWithApiRateLimitHeaders,
  mockHasTeamAccess,
  mockListTeamsForUser,
  mockCreateTeamForUser
} = vi.hoisted(() => ({
  mockResolveTeamRequestIdentity: vi.fn(),
  mockEnforceApiRateLimit: vi.fn(),
  mockWithApiRateLimitHeaders: vi.fn((response: Response) => response),
  mockHasTeamAccess: vi.fn(),
  mockListTeamsForUser: vi.fn(),
  mockCreateTeamForUser: vi.fn()
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
  listTeamsForUser: mockListTeamsForUser,
  createTeamForUser: mockCreateTeamForUser
}));

import { GET, POST } from "@/app/api/teams/route";

describe("teams route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveTeamRequestIdentity.mockResolvedValue({
      userKey: "owner@example.com",
      userEmail: "owner@example.com",
      sessionUser: { email: "owner@example.com" }
    });
    mockEnforceApiRateLimit.mockReturnValue({
      ok: true,
      state: { limit: 100, remaining: 99, resetAt: Date.now() + 60_000 }
    });
    mockHasTeamAccess.mockReturnValue(true);
    mockListTeamsForUser.mockResolvedValue([]);
    mockCreateTeamForUser.mockResolvedValue({
      id: "team_1",
      name: "Acme Team",
      slug: "acme-team",
      role: "owner",
      memberCount: 1,
      pendingInviteCount: 0
    });
  });

  it("returns unauthorized when user key is missing", async () => {
    mockResolveTeamRequestIdentity.mockResolvedValueOnce({
      userKey: null,
      userEmail: null,
      sessionUser: null
    });
    const response = await GET(new Request("http://localhost/api/teams"));
    expect(response.status).toBe(401);
  });

  it("lists teams for authenticated users", async () => {
    mockListTeamsForUser.mockResolvedValueOnce([
      {
        id: "team_1",
        name: "Acme Team",
        slug: "acme-team",
        role: "owner",
        memberCount: 2,
        pendingInviteCount: 1
      }
    ]);

    const response = await GET(new Request("http://localhost/api/teams"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      teams: [{ slug: "acme-team", memberCount: 2 }]
    });
    expect(mockListTeamsForUser).toHaveBeenCalledWith("owner@example.com");
  });

  it("creates a team from POST payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Acme Team" })
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      team: { slug: "acme-team" }
    });
    expect(mockCreateTeamForUser).toHaveBeenCalledWith({
      userId: "owner@example.com",
      name: "Acme Team"
    });
  });

  it("validates team name on POST", async () => {
    const response = await POST(
      new Request("http://localhost/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Team name is required."
    });
    expect(mockCreateTeamForUser).not.toHaveBeenCalled();
  });

  it("returns rate limit response when request is throttled", async () => {
    mockEnforceApiRateLimit.mockReturnValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 })
    });
    const response = await GET(new Request("http://localhost/api/teams"));
    expect(response.status).toBe(429);
    expect(mockListTeamsForUser).not.toHaveBeenCalled();
  });
});
