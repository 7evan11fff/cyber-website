import type { DigestFrequency, WatchlistEntry } from "@/lib/userData";

const GRADE_SCORE: Record<string, number> = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  F: 1
};

export type DigestDomainSummary = {
  url: string;
  domain: string;
  grade: string;
  checkedAt: string;
  needsAttention: boolean;
};

export type DigestGradeChange = {
  url: string;
  domain: string;
  previousGrade: string;
  currentGrade: string;
  direction: "improved" | "regressed" | "changed";
};

export type DigestSummary = {
  domains: DigestDomainSummary[];
  changes: DigestGradeChange[];
  snapshot: Record<string, string>;
  stats: {
    totalDomainsMonitored: number;
    averageScore: number;
    averageGrade: string;
    domainsNeedingAttention: number;
  };
};

export function normalizeDigestDomainKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    return parsed.hostname.trim().toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

export function getDomainLabel(value: string): string {
  const normalized = normalizeDigestDomainKey(value);
  return normalized || value.trim();
}

export function getGradeDirection(previousGrade: string, currentGrade: string) {
  const previousScore = GRADE_SCORE[previousGrade.toUpperCase()] ?? 0;
  const currentScore = GRADE_SCORE[currentGrade.toUpperCase()] ?? 0;
  if (currentScore > previousScore) return "improved";
  if (currentScore < previousScore) return "regressed";
  return "changed";
}

function normalizeGrade(value: string): string {
  const grade = value.trim().toUpperCase();
  return /^[A-F]$/.test(grade) ? grade : "F";
}

function getAverageGrade(score: number): string {
  if (score >= 4.5) return "A";
  if (score >= 3.5) return "B";
  if (score >= 2.5) return "C";
  if (score >= 1.5) return "D";
  return "F";
}

function scoreForGrade(grade: string): number {
  return GRADE_SCORE[grade] ?? 1;
}

function getWeekStartUtc(date: Date): number {
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday);
}

export function shouldSendDigestNow({
  frequency,
  now = new Date(),
  lastSentAt,
  enforceSchedule = true
}: {
  frequency: DigestFrequency;
  now?: Date;
  lastSentAt?: string | null;
  enforceSchedule?: boolean;
}): { shouldSend: boolean; reason?: string } {
  if (frequency === "off") {
    return { shouldSend: false, reason: "digest_disabled" };
  }

  if (enforceSchedule) {
    if (now.getUTCDay() !== 1) {
      return { shouldSend: false, reason: "outside_scheduled_day" };
    }
    if (frequency === "monthly" && now.getUTCDate() > 7) {
      return { shouldSend: false, reason: "outside_first_week_window" };
    }
  }

  const lastSentAtMs = lastSentAt ? new Date(lastSentAt).getTime() : Number.NaN;
  if (!Number.isFinite(lastSentAtMs)) {
    return { shouldSend: true };
  }

  if (frequency === "weekly") {
    const currentWeekStart = getWeekStartUtc(now);
    if (lastSentAtMs >= currentWeekStart) {
      return { shouldSend: false, reason: "already_sent_this_week" };
    }
    return { shouldSend: true };
  }

  const currentMonthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  if (lastSentAtMs >= currentMonthStart) {
    return { shouldSend: false, reason: "already_sent_this_month" };
  }
  return { shouldSend: true };
}

export function buildDigestSummary(
  watchlist: Pick<WatchlistEntry, "url" | "lastGrade" | "lastCheckedAt">[],
  previousSnapshot: Record<string, string>
): DigestSummary {
  const domainByKey = new Map<
    string,
    Pick<WatchlistEntry, "url" | "lastGrade" | "lastCheckedAt">
  >();

  for (const entry of watchlist) {
    const key = normalizeDigestDomainKey(entry.url);
    if (!key) continue;
    const existing = domainByKey.get(key);
    if (!existing) {
      domainByKey.set(key, entry);
      continue;
    }
    const existingMs = new Date(existing.lastCheckedAt).getTime();
    const incomingMs = new Date(entry.lastCheckedAt).getTime();
    if (Number.isFinite(incomingMs) && (!Number.isFinite(existingMs) || incomingMs > existingMs)) {
      domainByKey.set(key, entry);
    }
  }

  const domains: DigestDomainSummary[] = [];
  const changes: DigestGradeChange[] = [];
  const snapshot: Record<string, string> = {};

  for (const [key, entry] of domainByKey.entries()) {
    const grade = normalizeGrade(entry.lastGrade);
    snapshot[key] = grade;
    const previousGrade = normalizeGrade(previousSnapshot[key] ?? "");
    const score = scoreForGrade(grade);
    domains.push({
      url: entry.url,
      domain: getDomainLabel(entry.url),
      grade,
      checkedAt: entry.lastCheckedAt,
      needsAttention: score <= 3
    });
    if (previousSnapshot[key] && previousGrade !== grade) {
      changes.push({
        url: entry.url,
        domain: getDomainLabel(entry.url),
        previousGrade,
        currentGrade: grade,
        direction: getGradeDirection(previousGrade, grade)
      });
    }
  }

  domains.sort((a, b) => {
    const gradeDiff = scoreForGrade(a.grade) - scoreForGrade(b.grade);
    if (gradeDiff !== 0) return gradeDiff;
    return a.domain.localeCompare(b.domain);
  });
  changes.sort((a, b) => a.domain.localeCompare(b.domain));

  const totalDomainsMonitored = domains.length;
  const totalScore = domains.reduce((sum, domain) => sum + scoreForGrade(domain.grade), 0);
  const averageScore = totalDomainsMonitored > 0 ? totalScore / totalDomainsMonitored : 0;
  const domainsNeedingAttention = domains.filter((domain) => domain.needsAttention).length;

  return {
    domains,
    changes,
    snapshot,
    stats: {
      totalDomainsMonitored,
      averageScore,
      averageGrade: totalDomainsMonitored > 0 ? getAverageGrade(averageScore) : "N/A",
      domainsNeedingAttention
    }
  };
}
