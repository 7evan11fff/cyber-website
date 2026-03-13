export type ScanHistoryEntry = {
  id: string;
  url: string;
  grade: string;
  checkedAt: string;
};

export type WatchlistEntry = {
  id: string;
  url: string;
  lastGrade: string;
  previousGrade: string | null;
  lastCheckedAt: string;
};

export type UserDataRecord = {
  watchlist: WatchlistEntry[];
  scanHistory: ScanHistoryEntry[];
  alertEmail: string | null;
  notificationOnGradeChange: boolean;
  updatedAt: string;
};

export const HISTORY_STORAGE_KEY = "security-header-checker:scan-history";
export const WATCHLIST_STORAGE_KEY = "security-header-checker:watchlist";
export const WATCHLIST_ALERT_EMAIL_STORAGE_KEY = "security-header-checker:watchlist-alert-email";
export const MAX_HISTORY_ITEMS = 10;
export const MAX_WATCHLIST_ITEMS = 20;

export function isScanHistoryEntry(value: unknown): value is ScanHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ScanHistoryEntry>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.url === "string" &&
    typeof candidate.grade === "string" &&
    typeof candidate.checkedAt === "string"
  );
}

export function isWatchlistEntry(value: unknown): value is WatchlistEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WatchlistEntry>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.url === "string" &&
    typeof candidate.lastGrade === "string" &&
    typeof candidate.lastCheckedAt === "string" &&
    (candidate.previousGrade === null || typeof candidate.previousGrade === "string")
  );
}

export function createEmptyUserDataRecord(): UserDataRecord {
  return {
    watchlist: [],
    scanHistory: [],
    alertEmail: null,
    notificationOnGradeChange: false,
    updatedAt: new Date(0).toISOString()
  };
}

export function normalizeWatchlistEntries(entries: unknown[]): WatchlistEntry[] {
  const dedupedByUrl = new Map<string, WatchlistEntry>();
  for (const entry of entries) {
    if (!isWatchlistEntry(entry)) continue;
    const previous = dedupedByUrl.get(entry.url);
    if (!previous) {
      dedupedByUrl.set(entry.url, entry);
      continue;
    }

    const previousTime = new Date(previous.lastCheckedAt).getTime();
    const entryTime = new Date(entry.lastCheckedAt).getTime();
    if (Number.isFinite(entryTime) && (!Number.isFinite(previousTime) || entryTime >= previousTime)) {
      dedupedByUrl.set(entry.url, entry);
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
    dedupedByKey.set(`${entry.url}::${entry.checkedAt}`, entry);
  }

  return Array.from(dedupedByKey.values())
    .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())
    .slice(0, MAX_HISTORY_ITEMS);
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
