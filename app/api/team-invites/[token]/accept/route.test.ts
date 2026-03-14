// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetServerSession,
  mockGetUserKeyFromSessionUser,
  mockHasTeamAccess,
  mockAcceptTeamInvite
} = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockGetUserKeyFromSessionUser: vi.fn(),
  mockHasTeamAccess: vi.fn(),
  mockAcceptTeamInvite: vi.fn()
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
  acceptTeamInvite: mockAcceptTeamInvite
}));

import { POST } from "@/app/api/team-invites/[token]/accept/route";

describe("team invite acceptance route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { email: "member@example.com" } });
    mockGetUserKeyFromSessionUser.mockReturnValue("member@example.com");
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
    mockGetServerSession.mockResolvedValueOnce({ user: { name: "No Email User" } });
    mockGetUserKeyFromSessionUser.mockReturnValueOnce("no-email-user");

    const response = await POST(new Request("http://localhost/api/team-invites/token/accept"), {
      params: { token: "invite-token" }
    });

    expect(response.status).toBe(401);
    expect(mockAcceptTeamInvite).not.toHaveBeenCalled();
  });
});
