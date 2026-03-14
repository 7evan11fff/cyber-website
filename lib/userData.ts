export type ScanHistoryEntry = {
  id: string;
  url: string;
  grade: string;
  checkedAt: string;
  score?: number;
  maxScore?: number;
  headerStatuses?: Record<string, "good" | "weak" | "missing">;
};

export type ComparisonHistoryEntry = {
  id: string;
  siteAUrl: string;
  siteAGrade: string;
  siteBUrl: string;
  siteBGrade: string;
  checkedAt: string;
};

export type DomainGradeHistoryPoint = {
  grade: string;
  checkedAt: string;
};

export type DomainGradeHistoryRecord = Record<string, DomainGradeHistoryPoint[]>;

export type WatchlistEntry = {
  id: string;
  url: string;
  teamId?: string | null;
  lastGrade: string;
  previousGrade: string | null;
  lastCheckedAt: string;
};

export type WebhookRegistration = {
  id: string;
  url: string;
  createdAt: string;
};

export const NOTIFICATION_FREQUENCIES = ["instant", "daily", "weekly"] as const;
export type NotificationFrequency = (typeof NOTIFICATION_FREQUENCIES)[number];

export type UserDataRecord = {
  watchlist: WatchlistEntry[];
  scanHistory: ScanHistoryEntry[];
  comparisonHistory: ComparisonHistoryEntry[];
  history: DomainGradeHistoryRecord;
  alertEmail: string | null;
  notificationOnGradeChange: boolean;
  notificationFrequency: NotificationFrequency;
  browserNotificationsEnabled: boolean;
  watchlistNotificationLog: Record<string, string>;
  webhooks: WebhookRegistration[];
  apiKey: string | null;
  updatedAt: string;
};

export const HISTORY_STORAGE_KEY = "security-header-checker:scan-history";
export const COMPARISON_HISTORY_STORAGE_KEY = "security-header-checker:comparison-history";
export const DOMAIN_HISTORY_STORAGE_KEY = "security-header-checker:domain-grade-history";
export const WATCHLIST_STORAGE_KEY = "security-header-checker:watchlist";
export const WATCHLIST_ALERT_EMAIL_STORAGE_KEY = "security-header-checker:watchlist-alert-email";
export const WATCHLIST_NOTIFICATION_FREQUENCY_STORAGE_KEY =
  "security-header-checker:watchlist-notification-frequency";
export const BROWSER_NOTIFICATIONS_ENABLED_STORAGE_KEY =
  "security-header-checker:browser-notifications-enabled";
export const MAX_HISTORY_ITEMS = 10;
export const MAX_DOMAIN_HISTORY_POINTS = 30;
export const DOMAIN_HISTORY_RETENTION_DAYS = 90;
export const MAX_WATCHLIST_ITEMS = 20;
export const MAX_WEBHOOK_ITEMS = 20;

const API_KEY_PATTERN = /^shc_[a-f0-9]{48}$/;

function isHeaderStatus(value: unknown): value is "good" | "weak" | "missing" {
  return value === "good" || value === "weak" || value === "missing";
}

function normalizeHeaderStatuses(value: unknown): Record<string, "good" | "weak" | "missing"> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const normalized: Record<string, "good" | "weak" | "missing"> = {};
  for (const [key, status] of Object.entries(value)) {
    if (!key || !isHeaderStatus(status)) continue;
    normalized[key] = status;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function isScanHistoryEntry(value: unknown): value is ScanHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ScanHistoryEntry>;
  const hasValidScore =
    candidate.score === undefined ||
    (typeof candidate.score === "number" && Number.isFinite(candidate.score) && candidate.score >= 0);
  const hasValidMaxScore =
    candidate.maxScore === undefined ||
    (typeof candidate.maxScore === "number" && Number.isFinite(candidate.maxScore) && candidate.maxScore > 0);
  const hasValidHeaderStatuses =
    candidate.headerStatuses === undefined ||
    normalizeHeaderStatuses(candidate.headerStatuses) !== undefined;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.url === "string" &&
    typeof candidate.grade === "string" &&
    typeof candidate.checkedAt === "string" &&
    hasValidScore &&
    hasValidMaxScore &&
    hasValidHeaderStatuses
  );
}

export function isComparisonHistoryEntry(value: unknown): value is ComparisonHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ComparisonHistoryEntry>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.siteAUrl === "string" &&
    typeof candidate.siteAGrade === "string" &&
    typeof candidate.siteBUrl === "string" &&
    typeof candidate.siteBGrade === "string" &&
    typeof candidate.checkedAt === "string"
  );
}

export function isDomainGradeHistoryPoint(value: unknown): value is DomainGradeHistoryPoint {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DomainGradeHistoryPoint>;
  return typeof candidate.grade === "string" && typeof candidate.checkedAt === "string";
}

export function isWatchlistEntry(value: unknown): value is WatchlistEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WatchlistEntry>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.url === "string" &&
    (candidate.teamId === undefined || candidate.teamId === null || typeof candidate.teamId === "string") &&
    typeof candidate.lastGrade === "string" &&
    typeof candidate.lastCheckedAt === "string" &&
    (candidate.previousGrade === null || typeof candidate.previousGrade === "string")
  );
}

export function isNotificationFrequency(value: unknown): value is NotificationFrequency {
  return (
    typeof value === "string" &&
    (NOTIFICATION_FREQUENCIES as readonly string[]).includes(value)
  );
}

export function isApiKey(value: unknown): value is string {
  return typeof value === "string" && API_KEY_PATTERN.test(value.trim());
}

export function isWebhookRegistration(value: unknown): value is WebhookRegistration {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WebhookRegistration>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.url === "string" &&
    typeof candidate.createdAt === "string"
  );
}

export function normalizeWatchlistNotificationLog(
  value: unknown
): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const entries = Object.entries(value);
  const normalized: Record<string, string> = {};
  for (const [key, timestamp] of entries) {
    if (typeof key !== "string" || typeof timestamp !== "string") continue;
    const parsed = new Date(timestamp);
    if (!Number.isFinite(parsed.getTime())) continue;
    normalized[key.toLowerCase()] = parsed.toISOString();
  }
  return normalized;
}

export function normalizeWebhookRegistrations(entries: unknown[]): WebhookRegistration[] {
  const dedupedByUrl = new Map<string, WebhookRegistration>();

  for (const webhook of entries) {
    if (!isWebhookRegistration(webhook)) continue;

    let normalizedUrl: string;
    try {
      const parsed = new URL(webhook.url.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) continue;
      parsed.hash = "";
      normalizedUrl = parsed.toString();
    } catch {
      continue;
    }

    const createdAtMs = new Date(webhook.createdAt).getTime();
    if (!Number.isFinite(createdAtMs)) continue;
    const normalizedCreatedAt = new Date(createdAtMs).toISOString();
    const dedupeKey = normalizedUrl.toLowerCase();
    const existing = dedupedByUrl.get(dedupeKey);
    if (!existing) {
      dedupedByUrl.set(dedupeKey, {
        id: webhook.id,
        url: normalizedUrl,
        createdAt: normalizedCreatedAt
      });
      continue;
    }

    const existingCreatedAtMs = new Date(existing.createdAt).getTime();
    if (createdAtMs >= existingCreatedAtMs) {
      dedupedByUrl.set(dedupeKey, {
        id: webhook.id,
        url: normalizedUrl,
        createdAt: normalizedCreatedAt
      });
    }
  }

  return Array.from(dedupedByUrl.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_WEBHOOK_ITEMS);
}

export function createEmptyUserDataRecord(): UserDataRecord {
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
    updatedAt: new Date(0).toISOString()
  };
}

export function getDomainKeyFromUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    return parsed.hostname ? parsed.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function normalizeWatchlistEntries(entries: unknown[]): WatchlistEntry[] {
  const dedupedByUrl = new Map<string, WatchlistEntry>();
  for (const entry of entries) {
    if (!isWatchlistEntry(entry)) continue;
    const teamId =
      typeof entry.teamId === "string" && entry.teamId.trim().length > 0 ? entry.teamId.trim() : null;
    const normalizedEntry: WatchlistEntry = {
      id: entry.id,
      url: entry.url,
      teamId,
      lastGrade: entry.lastGrade,
      previousGrade: entry.previousGrade,
      lastCheckedAt: entry.lastCheckedAt
    };
    const dedupeKey = `${teamId ?? "personal"}::${entry.url}`;
    const previous = dedupedByUrl.get(dedupeKey);
    if (!previous) {
      dedupedByUrl.set(dedupeKey, normalizedEntry);
      continue;
    }

    const previousTime = new Date(previous.lastCheckedAt).getTime();
    const entryTime = new Date(normalizedEntry.lastCheckedAt).getTime();
    if (Number.isFinite(entryTime) && (!Number.isFinite(previousTime) || entryTime >= previousTime)) {
      dedupedByUrl.set(dedupeKey, normalizedEntry);
    }
  }

  return Array.from(dedupedByUrl.values())
    .sort((a, b) => new Date(b.lastCheckedAt).getTime() - new Date(a.lastCheckedAt).getTime())
    .slice(0, MAX_WATCHLIST_ITEMS);
}

export function normalizeScanHistoryEntries(entries: unknown[]): ScanHistoryEntry[] {
  const dedupedByKey = new Map<string, ScanHistoryEntry>();
  for (const entry of entries) {
    if (!isScanHistoryEntry(entry)) continue;
    const normalizedEntry: ScanHistoryEntry = {
      id: entry.id,
      url: entry.url,
      grade: entry.grade,
      checkedAt: entry.checkedAt,
      score: typeof entry.score === "number" && Number.isFinite(entry.score) ? entry.score : undefined,
      maxScore: typeof entry.maxScore === "number" && Number.isFinite(entry.maxScore) ? entry.maxScore : undefined,
      headerStatuses: normalizeHeaderStatuses(entry.headerStatuses)
    };

    const key = `${entry.url}::${entry.checkedAt}`;
    const previous = dedupedByKey.get(key);
    if (!previous) {
      dedupedByKey.set(key, normalizedEntry);
      continue;
    }

    dedupedByKey.set(key, {
      ...previous,
      id: normalizedEntry.id || previous.id,
      score: normalizedEntry.score ?? previous.score,
      maxScore: normalizedEntry.maxScore ?? previous.maxScore,
      headerStatuses: normalizedEntry.headerStatuses ?? previous.headerStatuses
    });
  }

  return Array.from(dedupedByKey.values())
    .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())
    .slice(0, MAX_HISTORY_ITEMS);
}

export function normalizeComparisonHistoryEntries(entries: unknown[]): ComparisonHistoryEntry[] {
  const dedupedByKey = new Map<string, ComparisonHistoryEntry>();
  for (const entry of entries) {
    if (!isComparisonHistoryEntry(entry)) continue;
    dedupedByKey.set(
      `${entry.siteAUrl}::${entry.siteBUrl}::${entry.checkedAt}`,
      entry
    );
  }

  return Array.from(dedupedByKey.values())
    .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())
    .slice(0, MAX_HISTORY_ITEMS);
}

export function normalizeDomainGradeHistory(value: unknown): DomainGradeHistoryRecord {
  if (!value || typeof value !== "object") return {};
  const retentionMs = DOMAIN_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - retentionMs;

  const normalized: DomainGradeHistoryRecord = {};
  for (const [rawDomain, points] of Object.entries(value)) {
    const domain = getDomainKeyFromUrl(rawDomain);
    if (!domain || !Array.isArray(points)) continue;

    const dedupedByTimestamp = new Map<string, DomainGradeHistoryPoint>();
    for (const point of points) {
      if (!isDomainGradeHistoryPoint(point)) continue;
      const checkedAtTime = new Date(point.checkedAt).getTime();
      if (!Number.isFinite(checkedAtTime) || checkedAtTime < cutoff) continue;
      dedupedByTimestamp.set(new Date(checkedAtTime).toISOString(), {
        checkedAt: new Date(checkedAtTime).toISOString(),
        grade: point.grade
      });
    }

    const nextPoints = Array.from(dedupedByTimestamp.values())
      .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())
      .slice(0, MAX_DOMAIN_HISTORY_POINTS);

    if (nextPoints.length > 0) {
      normalized[domain] = nextPoints;
    }
  }

  return normalized;
}

export function mergeDomainGradeHistories(
  primary: DomainGradeHistoryRecord,
  secondary: DomainGradeHistoryRecord
): DomainGradeHistoryRecord {
  const combined: Record<string, DomainGradeHistoryPoint[]> = {};
  for (const source of [secondary, primary]) {
    for (const [domain, points] of Object.entries(source)) {
      combined[domain] = [...(combined[domain] ?? []), ...points];
    }
  }
  return normalizeDomainGradeHistory(combined);
}

export function recordDomainGradeHistoryPoint(
  history: DomainGradeHistoryRecord,
  sample: { url: string; grade: string; checkedAt: string }
): DomainGradeHistoryRecord {
  const domain = getDomainKeyFromUrl(sample.url);
  if (!domain) {
    return normalizeDomainGradeHistory(history);
  }
  return normalizeDomainGradeHistory({
    ...history,
    [domain]: [...(history[domain] ?? []), { grade: sample.grade, checkedAt: sample.checkedAt }]
  });
}

export function mergeWatchlists(primary: WatchlistEntry[], secondary: WatchlistEntry[]): WatchlistEntry[] {
  return normalizeWatchlistEntries([...primary, ...secondary]);
}

export function mergeScanHistories(
  primary: ScanHistoryEntry[],
  secondary: ScanHistoryEntry[]
): ScanHistoryEntry[] {
  return normalizeScanHistoryEntries([...primary, ...secondary]);
}

export function mergeComparisonHistories(
  primary: ComparisonHistoryEntry[],
  secondary: ComparisonHistoryEntry[]
): ComparisonHistoryEntry[] {
  return normalizeComparisonHistoryEntries([...primary, ...secondary]);
}
