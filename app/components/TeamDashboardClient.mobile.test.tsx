import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TeamDashboardClient } from "@/app/components/TeamDashboardClient";

describe("TeamDashboardClient mobile layout", () => {
  it("renders watchlist in an overflow wrapper for small screens", () => {
    render(
      <TeamDashboardClient
        slug="acme-team"
        viewerUserId="owner@example.com"
        initialSnapshot={{
          team: {
            id: "team_1",
            name: "Acme Team",
            slug: "acme-team",
            role: "owner",
            memberCount: 2,
            pendingInviteCount: 0
          },
          members: [
            {
              teamId: "team_1",
              userId: "owner@example.com",
              role: "owner",
              invitedAt: "2026-01-01T00:00:00.000Z",
              joinedAt: "2026-01-01T00:00:00.000Z"
            }
          ],
          watchlist: [
            {
              id: "entry_1",
              teamId: "team_1",
              url: "https://example.com",
              lastGrade: "B",
              previousGrade: "C",
              lastCheckedAt: "2026-01-01T00:00:00.000Z",
              createdAt: "2026-01-01T00:00:00.000Z",
              createdByUserId: "owner@example.com"
            }
          ],
          memberProfiles: {
            "owner@example.com": {
              userKey: "owner@example.com",
              displayName: "Owner Example",
              avatarInitials: "OE",
              avatarUrl: null
            }
          },
          activity: []
        }}
      />
    );

    expect(screen.getByRole("button", { name: /scan all/i })).toBeInTheDocument();
    const tableWrapper = screen.getByTestId("team-watchlist-table-wrapper");
    expect(tableWrapper).toHaveClass("overflow-x-auto");
    expect(screen.getByText("Trend")).toBeInTheDocument();
  });
});
