import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TeamActivityFeed } from "@/app/components/TeamActivityFeed";

const memberProfiles = {
  "alice@example.com": {
    userKey: "alice@example.com",
    displayName: "Alice Example",
    avatarInitials: "AE",
    avatarUrl: null
  },
  "bob@example.com": {
    userKey: "bob@example.com",
    displayName: "Bob Example",
    avatarInitials: "BE",
    avatarUrl: null
  }
};

describe("TeamActivityFeed", () => {
  it("renders events when expanded", () => {
    render(
      <TeamActivityFeed
        memberProfiles={memberProfiles}
        events={[
          {
            id: "evt_1",
            type: "watchlist_added",
            actorUserId: "alice@example.com",
            createdAt: "2026-01-01T12:00:00.000Z",
            subjectUserId: null,
            subjectUrl: "https://example.com",
            beforeValue: null,
            afterValue: "A",
            message: "added a URL to the shared watchlist."
          }
        ]}
      />
    );

    expect(screen.queryByText(/added a URL to the shared watchlist/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show activity/i }));

    expect(screen.getByText(/Alice Example/i)).toBeInTheDocument();
    expect(screen.getByText(/added a URL to the shared watchlist/i)).toBeInTheDocument();
    expect(screen.getByText(/URL: https:\/\/example.com/i)).toBeInTheDocument();
  });

  it("shows onboarding empty state when no events exist", () => {
    render(<TeamActivityFeed events={[]} memberProfiles={memberProfiles} />);

    fireEvent.click(screen.getByRole("button", { name: /show activity/i }));
    expect(
      screen.getByText(/Activity will appear here as teammates add URLs, run scans, and manage team membership/i)
    ).toBeInTheDocument();
  });
});
