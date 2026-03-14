import type { TrendDirection } from "@/lib/gradeTrends";
import { gradeToScore, sortHistoryAscending } from "@/lib/gradeTrends";
import { getAllHeaderInfo, type HeaderStatus } from "@/lib/securityHeaders";
import {
  getDomainKeyFromUrl,
  type DomainGradeHistoryPoint,
  type ScanHistoryEntry,
  type UserDataRecord,
  type WatchlistEntry
} from "@/lib/userData";

export type TrendWindowSummary = {
  windowDays: 7 | 30;
  hasEnoughData: boolean;
  direction: TrendDirection;
  scoreDelta: number | null;
  percentChange: number | null;
  startGrade: string | null;
  endGrade: string | null;
  startCheckedAt: string | null;
  endCheckedAt: string | null;
};

export type HeaderStatusChange = {
  headerKey: string;
  headerLabel: string;
  from: HeaderStatus;
  to: HeaderStatus;
};

export type DomainTrendTimelineEntry = {
  checkedAt: string;
  grade: string;
  headerChanges: HeaderStatusChange[];
};

export type DomainTrendSummary = {
  domain: string;
  displayUrl: string;
  latestGrade: string | null;
  latestCheckedAt: string | null;
  sparklinePoints: DomainGradeHistoryPoint[];
  overallDirection: TrendDirection;
  trend7d: TrendWindowSummary;
  trend30d: TrendWindowSummary;
  timeline: DomainTrendTimelineEntry[];
};

export type AggregateTrendStats = {
  totalDomainsMonitored: number;
  averageScore: number | null;
  averageGrade: string;
  improvedThisWeek: number;
  regressedThisWeek: number;
};

export type WatchlistTrendDashboardData = {
  aggregate: AggregateTrendStats;
  domains: DomainTrendSummary[];
};

const HEADER_LABELS = new Map(getAllHeaderInfo().map((header) => [header.key, header.label]));
const HEADER_STATUS_RANK: Record<HeaderStatus, number> = {
  good: 3,
  weak: 2,
  missing: 1
};

function normalizeHistoryPoints(points: DomainGradeHistoryPoint[]): DomainGradeHistoryPoint[] {
  return sortHistoryAscending(points).filter((point) => {
    const checkedAtTime = new Date(point.checkedAt).getTime();
    return Number.isFinite(checkedAtTime) && gradeToScore(point.grade) > 0;
  });
}

function deriveDirection(startScore: number, endScore: number): TrendDirection {
  if (endScore > startScore) return "improving";
  if (endScore < startScore) return "degrading";
  return "stable";
}

function scoreToAverageGrade(score: number | null): string {
  if (score === null || !Number.isFinite(score)) return "--";
  if (score >= 4.5) return "A";
  if (score >= 3.5) return "B";
  if (score >= 2.5) return "C";
  if (score >= 1.5) return "D";
  return "F";
}

function buildWindowTrend(points: DomainGradeHistoryPoint[], windowDays: 7 | 30): TrendWindowSummary {
  const emptySummary: TrendWindowSummary = {
    windowDays,
    hasEnoughData: false,
    direction: "stable",
    scoreDelta: null,
    percentChange: null,
    startGrade: null,
    endGrade: null,
    startCheckedAt: null,
    endCheckedAt: null
  };

  if (points.length < 2) {
    return emptySummary;
  }

  const latest = points[points.length - 1];
  const latestTime = new Date(latest.checkedAt).getTime();
  if (!Number.isFinite(latestTime)) {
    return emptySummary;
  }

  const windowStartMs = latestTime - windowDays * 24 * 60 * 60 * 1000;
  const inWindow = points.filter((point) => new Date(point.checkedAt).getTime() >= windowStartMs);
  if (inWindow.length < 2) {
    return emptySummary;
  }

  const start = inWindow[0];
  const end = inWindow[inWindow.length - 1];
  const startScore = gradeToScore(start.grade);
  const endScore = gradeToScore(end.grade);
  if (startScore <= 0 || endScore <= 0) {
    return emptySummary;
  }

  const scoreDelta = Number((endScore - startScore).toFixed(2));
  const percentChange = Number((((endScore - startScore) / startScore) * 100).toFixed(2));

  return {
    windowDays,
    hasEnoughData: true,
    direction: deriveDirection(startScore, endScore),
    scoreDelta,
    percentChange,
    startGrade: start.grade,
    endGrade: end.grade,
    startCheckedAt: start.checkedAt,
    endCheckedAt: end.checkedAt
  };
}

function buildHeaderChangesForDomain(entries: ScanHistoryEntry[]): Map<string, HeaderStatusChange[]> {
  const sorted = [...entries]
    .filter((entry) => Number.isFinite(new Date(entry.checkedAt).getTime()))
    .sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime());

  const changesByTimestamp = new Map<string, HeaderStatusChange[]>();
  let previousWithStatuses: ScanHistoryEntry | null = null;

  for (const entry of sorted) {
    if (!entry.headerStatuses) continue;
    if (!previousWithStatuses?.headerStatuses) {
      previousWithStatuses = entry;
      continue;
    }

    const previousStatuses = previousWithStatuses.headerStatuses;
    const currentStatuses = entry.headerStatuses;
    const keys = new Set([...Object.keys(previousStatuses), ...Object.keys(currentStatuses)]);
    const changes: HeaderStatusChange[] = [];

    for (const key of keys) {
      const fromStatus = previousStatuses[key];
      const toStatus = currentStatuses[key];
      if (!fromStatus || !toStatus || fromStatus === toStatus) continue;
      changes.push({
        headerKey: key,
        headerLabel: HEADER_LABELS.get(key) ?? key,
        from: fromStatus,
        to: toStatus
      });
    }

    if (changes.length > 0) {
      changes.sort((a, b) => {
        const rankDelta =
          Math.abs(HEADER_STATUS_RANK[b.to] - HEADER_STATUS_RANK[b.from]) -
          Math.abs(HEADER_STATUS_RANK[a.to] - HEADER_STATUS_RANK[a.from]);
        if (rankDelta !== 0) return rankDelta;
        return a.headerLabel.localeCompare(b.headerLabel);
      });
      changesByTimestamp.set(entry.checkedAt, changes);
    }

    previousWithStatuses = entry;
  }

  return changesByTimestamp;
}

function chooseNewestEntry(current: WatchlistEntry | undefined, candidate: WatchlistEntry): WatchlistEntry {
  if (!current) return candidate;
  const currentTime = new Date(current.lastCheckedAt).getTime();
  const candidateTime = new Date(candidate.lastCheckedAt).getTime();
  if (!Number.isFinite(currentTime) && Number.isFinite(candidateTime)) return candidate;
  if (Number.isFinite(currentTime) && !Number.isFinite(candidateTime)) return current;
  if (candidateTime >= currentTime) return candidate;
  return current;
}

export function buildWatchlistTrendDashboardData(
  userData: Pick<UserDataRecord, "watchlist" | "history" | "scanHistory">
): WatchlistTrendDashboardData {
  const watchlistByDomain = new Map<string, WatchlistEntry>();
  for (const entry of userData.watchlist) {
    const domain = getDomainKeyFromUrl(entry.url);
    if (!domain) continue;
    const previous = watchlistByDomain.get(domain);
    watchlistByDomain.set(domain, chooseNewestEntry(previous, entry));
  }

  const domains: DomainTrendSummary[] = [];

  for (const [domain, watchlistEntry] of watchlistByDomain.entries()) {
    const storedHistory = normalizeHistoryPoints(userData.history[domain] ?? []);
    const sparklinePoints =
      storedHistory.length > 0
        ? storedHistory
        : Number.isFinite(new Date(watchlistEntry.lastCheckedAt).getTime()) && gradeToScore(watchlistEntry.lastGrade) > 0
          ? [{ grade: watchlistEntry.lastGrade, checkedAt: watchlistEntry.lastCheckedAt }]
          : [];

    const latestPoint = sparklinePoints[sparklinePoints.length - 1];
    const domainScans = userData.scanHistory.filter((entry) => getDomainKeyFromUrl(entry.url) === domain);
    const headerChangesByTimestamp = buildHeaderChangesForDomain(domainScans);
    const timeline: DomainTrendTimelineEntry[] = [...sparklinePoints]
      .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())
      .map((point) => ({
        checkedAt: point.checkedAt,
        grade: point.grade,
        headerChanges: headerChangesByTimestamp.get(point.checkedAt) ?? []
      }));

    const overallDirection =
      sparklinePoints.length > 1
        ? deriveDirection(gradeToScore(sparklinePoints[0].grade), gradeToScore(latestPoint?.grade ?? ""))
        : "stable";

    domains.push({
      domain,
      displayUrl: watchlistEntry.url,
      latestGrade: latestPoint?.grade ?? watchlistEntry.lastGrade ?? null,
      latestCheckedAt: latestPoint?.checkedAt ?? watchlistEntry.lastCheckedAt ?? null,
      sparklinePoints,
      overallDirection,
      trend7d: buildWindowTrend(sparklinePoints, 7),
      trend30d: buildWindowTrend(sparklinePoints, 30),
      timeline
    });
  }

  domains.sort((a, b) => {
    const aTime = a.latestCheckedAt ? new Date(a.latestCheckedAt).getTime() : 0;
    const bTime = b.latestCheckedAt ? new Date(b.latestCheckedAt).getTime() : 0;
    return bTime - aTime;
  });

  const latestScores = domains
    .map((domainTrend) => gradeToScore(domainTrend.latestGrade ?? ""))
    .filter((score) => score > 0);
  const averageScore =
    latestScores.length > 0
      ? Number((latestScores.reduce((sum, score) => sum + score, 0) / latestScores.length).toFixed(2))
      : null;

  const aggregate: AggregateTrendStats = {
    totalDomainsMonitored: domains.length,
    averageScore,
    averageGrade: scoreToAverageGrade(averageScore),
    improvedThisWeek: domains.filter(
      (domainTrend) => domainTrend.trend7d.hasEnoughData && domainTrend.trend7d.direction === "improving"
    ).length,
    regressedThisWeek: domains.filter(
      (domainTrend) => domainTrend.trend7d.hasEnoughData && domainTrend.trend7d.direction === "degrading"
    ).length
  };

  return {
    aggregate,
    domains
  };
}
