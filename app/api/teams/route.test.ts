// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetServerSession,
  mockGetUserKeyFromSessionUser,
  mockHasTeamAccess,
  mockListTeamsForUser,
  mockCreateTeamForUser
} = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockGetUserKeyFromSessionUser: vi.fn(),
  mockHasTeamAccess: vi.fn(),
  mockListTeamsForUser: vi.fn(),
  mockCreateTeamForUser: vi.fn()
}));

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {}
}));

vi.mock("@/lib/userDataStore", () => ({
  getUserKeyFromSessionUser: mockGetUserKeyFromSessionUser
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
    mockGetServerSession.mockResolvedValue({ user: { email: "owner@example.com" } });
    mockGetUserKeyFromSessionUser.mockReturnValue("owner@example.com");
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
    mockGetUserKeyFromSessionUser.mockReturnValueOnce(null);
    const response = await GET();
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

    const response = await GET();
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
});
