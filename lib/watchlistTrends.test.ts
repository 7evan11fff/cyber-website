import { describe, expect, it } from "vitest";
import { buildWatchlistTrendDashboardData } from "@/lib/watchlistTrends";
import type { UserDataRecord } from "@/lib/userData";

function createBaseUserData(): UserDataRecord {
  return {
    watchlist: [],
    scanHistory: [],
    comparisonHistory: [],
    history: {},
    alertEmail: null,
    notificationOnGradeChange: true,
    notificationFrequency: "instant",
    browserNotificationsEnabled: false,
    watchlistNotificationLog: {},
    webhooks: [],
    apiKey: null,
    updatedAt: new Date().toISOString()
  };
}

describe("buildWatchlistTrendDashboardData", () => {
  it("builds aggregate stats, trend windows, and header change timeline", () => {
    const userData = createBaseUserData();
    userData.watchlist = [
      {
        id: "watch-a",
        url: "https://alpha.example",
        lastGrade: "A",
        previousGrade: "B",
        lastCheckedAt: "2026-03-14T12:00:00.000Z"
      },
      {
        id: "watch-b",
        url: "https://beta.example",
        lastGrade: "C",
        previousGrade: "B",
        lastCheckedAt: "2026-03-14T12:00:00.000Z"
      }
    ];
    userData.history = {
      "alpha.example": [
        { grade: "A", checkedAt: "2026-03-14T12:00:00.000Z" },
        { grade: "B", checkedAt: "2026-03-10T12:00:00.000Z" },
        { grade: "C", checkedAt: "2026-03-01T12:00:00.000Z" }
      ],
      "beta.example": [
        { grade: "C", checkedAt: "2026-03-14T12:00:00.000Z" },
        { grade: "B", checkedAt: "2026-03-10T12:00:00.000Z" },
        { grade: "A", checkedAt: "2026-03-01T12:00:00.000Z" }
      ]
    };
    userData.scanHistory = [
      {
        id: "scan-alpha-1",
        url: "https://alpha.example",
        grade: "B",
        checkedAt: "2026-03-10T12:00:00.000Z",
        headerStatuses: {
          "content-security-policy": "weak",
          "strict-transport-security": "good"
        }
      },
      {
        id: "scan-alpha-2",
        url: "https://alpha.example",
        grade: "A",
        checkedAt: "2026-03-14T12:00:00.000Z",
        headerStatuses: {
          "content-security-policy": "good",
          "strict-transport-security": "good"
        }
      }
    ];

    const result = buildWatchlistTrendDashboardData(userData);
    expect(result.aggregate.totalDomainsMonitored).toBe(2);
    expect(result.aggregate.improvedThisWeek).toBe(1);
    expect(result.aggregate.regressedThisWeek).toBe(1);
    expect(result.aggregate.averageScore).toBe(4);
    expect(result.aggregate.averageGrade).toBe("B");

    const alpha = result.domains.find((entry) => entry.domain === "alpha.example");
    const beta = result.domains.find((entry) => entry.domain === "beta.example");
    expect(alpha).toBeTruthy();
    expect(beta).toBeTruthy();

    expect(alpha?.trend7d.direction).toBe("improving");
    expect(alpha?.trend7d.percentChange).toBe(25);
    expect(beta?.trend7d.direction).toBe("degrading");
    expect(beta?.trend7d.percentChange).toBe(-25);

    const alphaLatestTimeline = alpha?.timeline[0];
    expect(alphaLatestTimeline?.checkedAt).toBe("2026-03-14T12:00:00.000Z");
    expect(alphaLatestTimeline?.headerChanges.length).toBeGreaterThan(0);
    expect(alphaLatestTimeline?.headerChanges[0]?.headerLabel).toBe("Content-Security-Policy");
    expect(alphaLatestTimeline?.headerChanges[0]?.from).toBe("weak");
    expect(alphaLatestTimeline?.headerChanges[0]?.to).toBe("good");
  });
});
