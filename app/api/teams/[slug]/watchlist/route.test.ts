// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockResolveTeamRequestIdentity,
  mockEnforceApiRateLimit,
  mockWithApiRateLimitHeaders,
  mockHasTeamAccess,
  mockRunSecurityScan,
  mockAddOrUpdateTeamWatchlistEntryBySlug,
  mockListTeamWatchlistBySlugForUser,
  mockRemoveTeamWatchlistEntryBySlug
} = vi.hoisted(() => ({
  mockResolveTeamRequestIdentity: vi.fn(),
  mockEnforceApiRateLimit: vi.fn(),
  mockWithApiRateLimitHeaders: vi.fn((response: Response) => response),
  mockHasTeamAccess: vi.fn(),
  mockRunSecurityScan: vi.fn(),
  mockAddOrUpdateTeamWatchlistEntryBySlug: vi.fn(),
  mockListTeamWatchlistBySlugForUser: vi.fn(),
  mockRemoveTeamWatchlistEntryBySlug: vi.fn()
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

vi.mock("@/lib/securityReport", () => ({
  runSecurityScan: mockRunSecurityScan
}));

vi.mock("@/lib/teamDataStore", () => ({
  addOrUpdateTeamWatchlistEntryBySlug: mockAddOrUpdateTeamWatchlistEntryBySlug,
  listTeamWatchlistBySlugForUser: mockListTeamWatchlistBySlugForUser,
  removeTeamWatchlistEntryBySlug: mockRemoveTeamWatchlistEntryBySlug
}));

import { DELETE, POST } from "@/app/api/teams/[slug]/watchlist/route";

describe("team watchlist route", () => {
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
    mockRunSecurityScan.mockResolvedValue({
      checkedUrl: "https://example.com/",
      grade: "B",
      checkedAt: "2026-03-14T00:00:00.000Z"
    });
    mockAddOrUpdateTeamWatchlistEntryBySlug.mockResolvedValue({
      entry: {
        id: "entry_1",
        teamId: "team_1",
        url: "https://example.com/",
        lastGrade: "B",
        previousGrade: null,
        lastCheckedAt: "2026-03-14T00:00:00.000Z",
        createdAt: "2026-03-14T00:00:00.000Z",
        createdByUserId: "owner@example.com",
        lastScannedByUserId: "owner@example.com"
      },
      activity: {
        id: "scan_1",
        teamId: "team_1",
        entryId: "entry_1",
        url: "https://example.com/",
        grade: "B",
        scannedAt: "2026-03-14T00:00:00.000Z",
        scannedByUserId: "owner@example.com"
      }
    });
    mockListTeamWatchlistBySlugForUser.mockResolvedValue([]);
    mockRemoveTeamWatchlistEntryBySlug.mockResolvedValue({
      removed: true,
      activity: {
        id: "act_1",
        teamId: "team_1",
        entryId: "entry_1",
        url: "https://example.com/",
        action: "removed",
        occurredAt: "2026-03-14T01:00:00.000Z",
        actorUserId: "owner@example.com"
      }
    });
  });

  it("adds a watchlist domain from POST payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/teams/acme/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "example.com" })
      }),
      { params: { slug: "acme" } }
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      entry: { id: "entry_1", url: "https://example.com/" }
    });
    expect(mockRunSecurityScan).toHaveBeenCalledWith("example.com");
    expect(mockAddOrUpdateTeamWatchlistEntryBySlug).toHaveBeenCalledWith({
      slug: "acme",
      actorUserId: "owner@example.com",
      url: "https://example.com/",
      grade: "B",
      checkedAt: "2026-03-14T00:00:00.000Z"
    });
  });

  it("validates entryId on DELETE", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/teams/acme/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }),
      { params: { slug: "acme" } }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "entryId is required."
    });
    expect(mockRemoveTeamWatchlistEntryBySlug).not.toHaveBeenCalled();
  });

  it("returns mutation activity when domain is removed", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/teams/acme/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: "entry_1" })
      }),
      { params: { slug: "acme" } }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      removed: true,
      activity: {
        id: "act_1",
        action: "removed",
        actorUserId: "owner@example.com"
      }
    });
    expect(mockRemoveTeamWatchlistEntryBySlug).toHaveBeenCalledWith({
      slug: "acme",
      actorUserId: "owner@example.com",
      entryId: "entry_1"
    });
  });
});
