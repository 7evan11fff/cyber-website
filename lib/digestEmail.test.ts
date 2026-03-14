import { describe, expect, it } from "vitest";
import { buildDigestSummary, normalizeDigestDomainKey, shouldSendDigestNow } from "@/lib/digestEmail";

describe("normalizeDigestDomainKey", () => {
  it("normalizes domains and urls to lowercase hostnames", () => {
    expect(normalizeDigestDomainKey("https://Example.COM/path?q=1")).toBe("example.com");
    expect(normalizeDigestDomainKey("sub.example.com")).toBe("sub.example.com");
  });
});

describe("shouldSendDigestNow", () => {
  it("returns false when digest is disabled", () => {
    const result = shouldSendDigestNow({
      frequency: "off",
      now: new Date("2026-03-16T09:00:00.000Z")
    });
    expect(result).toEqual({ shouldSend: false, reason: "digest_disabled" });
  });

  it("sends weekly digest once per week on Mondays", () => {
    const now = new Date("2026-03-16T09:00:00.000Z"); // Monday
    const alreadySent = shouldSendDigestNow({
      frequency: "weekly",
      now,
      lastSentAt: "2026-03-16T01:00:00.000Z"
    });
    expect(alreadySent).toEqual({ shouldSend: false, reason: "already_sent_this_week" });

    const shouldSend = shouldSendDigestNow({
      frequency: "weekly",
      now,
      lastSentAt: "2026-03-09T09:00:00.000Z"
    });
    expect(shouldSend.shouldSend).toBe(true);
  });

  it("sends monthly digest only during first monday window", () => {
    const firstMonday = new Date("2026-06-01T09:00:00.000Z"); // Monday, day 1
    const eligible = shouldSendDigestNow({
      frequency: "monthly",
      now: firstMonday,
      lastSentAt: "2026-05-01T09:00:00.000Z"
    });
    expect(eligible.shouldSend).toBe(true);

    const secondMonday = new Date("2026-06-08T09:00:00.000Z"); // Monday, day 8
    const blocked = shouldSendDigestNow({
      frequency: "monthly",
      now: secondMonday
    });
    expect(blocked).toEqual({ shouldSend: false, reason: "outside_first_week_window" });
  });
});

describe("buildDigestSummary", () => {
  it("builds domain stats and grade change highlights", () => {
    const summary = buildDigestSummary(
      [
        {
          url: "https://example.com",
          lastGrade: "A",
          lastCheckedAt: "2026-03-15T09:00:00.000Z"
        },
        {
          url: "https://critical.io/security",
          lastGrade: "F",
          lastCheckedAt: "2026-03-15T09:00:00.000Z"
        },
        {
          url: "portal.company.net",
          lastGrade: "C",
          lastCheckedAt: "2026-03-14T09:00:00.000Z"
        },
        {
          url: "https://example.com/old",
          lastGrade: "B",
          lastCheckedAt: "2026-03-01T09:00:00.000Z"
        }
      ],
      {
        "example.com": "B",
        "critical.io": "F"
      }
    );

    expect(summary.stats.totalDomainsMonitored).toBe(3);
    expect(summary.stats.averageGrade).toBe("C");
    expect(summary.stats.domainsNeedingAttention).toBe(2);
    expect(summary.changes).toEqual([
      {
        url: "https://example.com",
        domain: "example.com",
        previousGrade: "B",
        currentGrade: "A",
        direction: "improved"
      }
    ]);
    expect(summary.snapshot).toEqual({
      "critical.io": "F",
      "example.com": "A",
      "portal.company.net": "C"
    });
  });
});
