import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createEmptyUserDataRecord,
  type UserDataRecord,
  isApiKey,
  isNotificationFrequency,
  normalizeComparisonHistoryEntries,
  normalizeDomainGradeHistory,
  normalizeWebhookRegistrations,
  normalizeWatchlistNotificationLog,
  normalizeScanHistoryEntries,
  normalizeWatchlistEntries
} from "@/lib/userData";

type UserDataFile = {
  users: Record<string, UserDataRecord>;
};

export type UserProfileRecord = {
  userKey: string;
  displayName: string;
  avatarInitials: string;
  avatarUrl: string | null;
};

const USER_DATA_FILE_PATH = path.join(process.cwd(), "data", "user-data.json");

function normalizeUserKey(input: string) {
  return input.trim().toLowerCase();
}

function toTitleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(" ");
}

function deriveDisplayNameFromUserKey(userKey: string): string {
  const trimmed = userKey.trim();
  if (!trimmed) return "Unknown user";
  const localPart = trimmed.includes("@") ? trimmed.split("@")[0] : trimmed;
  const normalized = localPart.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return trimmed;
  return toTitleCaseWords(normalized);
}

function deriveInitials(displayName: string): string {
  const parts = displayName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "?";
}

async function ensureDataFile(): Promise<void> {
  await mkdir(path.dirname(USER_DATA_FILE_PATH), { recursive: true });
  try {
    await readFile(USER_DATA_FILE_PATH, "utf8");
  } catch {
    const empty: UserDataFile = { users: {} };
    await writeFile(USER_DATA_FILE_PATH, JSON.stringify(empty, null, 2), "utf8");
  }
}

async function readDataFile(): Promise<UserDataFile> {
  await ensureDataFile();
  try {
    const raw = await readFile(USER_DATA_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<UserDataFile>;
    if (!parsed || typeof parsed !== "object" || !parsed.users || typeof parsed.users !== "object") {
      return { users: {} };
    }
    return parsed as UserDataFile;
  } catch {
    return { users: {} };
  }
}

async function writeDataFile(data: UserDataFile): Promise<void> {
  await ensureDataFile();
  await writeFile(USER_DATA_FILE_PATH, JSON.stringify(data, null, 2), "utf8");
}

function normalizeRecord(record: UserDataRecord): UserDataRecord {
  const normalizedFrequency = isNotificationFrequency(record.notificationFrequency)
    ? record.notificationFrequency
    : "instant";
  const normalizedNotificationOnGradeChange =
    typeof record.notificationOnGradeChange === "boolean"
      ? record.notificationOnGradeChange
      : createEmptyUserDataRecord().notificationOnGradeChange;

  return {
    watchlist: normalizeWatchlistEntries(Array.isArray(record.watchlist) ? record.watchlist : []),
    scanHistory: normalizeScanHistoryEntries(Array.isArray(record.scanHistory) ? record.scanHistory : []),
    comparisonHistory: normalizeComparisonHistoryEntries(
      Array.isArray(record.comparisonHistory) ? record.comparisonHistory : []
    ),
    history: normalizeDomainGradeHistory(record.history),
    alertEmail: typeof record.alertEmail === "string" ? record.alertEmail : null,
    notificationOnGradeChange: normalizedNotificationOnGradeChange,
    notificationFrequency: normalizedFrequency,
    browserNotificationsEnabled:
      typeof record.browserNotificationsEnabled === "boolean"
        ? record.browserNotificationsEnabled
        : createEmptyUserDataRecord().browserNotificationsEnabled,
    watchlistNotificationLog: normalizeWatchlistNotificationLog(record.watchlistNotificationLog),
    webhooks: normalizeWebhookRegistrations(Array.isArray(record.webhooks) ? record.webhooks : []),
    apiKey: isApiKey(record.apiKey) ? record.apiKey.trim() : null,
    updatedAt: record.updatedAt
  };
}

export function getUserKeyFromSessionUser(
  user: { email?: string | null; name?: string | null } | null | undefined
): string | null {
  const source = user?.email ?? user?.name ?? null;
  if (!source) return null;
  const key = normalizeUserKey(source);
  return key || null;
}

export async function getUserDataForUser(userKey: string): Promise<UserDataRecord> {
  const normalizedKey = normalizeUserKey(userKey);
  const data = await readDataFile();
  const stored = data.users[normalizedKey] ?? createEmptyUserDataRecord();
  return normalizeRecord(stored);
}

export async function updateUserDataForUser(
  userKey: string,
  patch: Partial<
    Pick<
      UserDataRecord,
      | "watchlist"
      | "scanHistory"
      | "comparisonHistory"
      | "history"
      | "alertEmail"
      | "notificationOnGradeChange"
      | "notificationFrequency"
      | "browserNotificationsEnabled"
      | "watchlistNotificationLog"
      | "webhooks"
      | "apiKey"
    >
  >
): Promise<UserDataRecord> {
  const normalizedKey = normalizeUserKey(userKey);
  const data = await readDataFile();
  const current = data.users[normalizedKey] ?? createEmptyUserDataRecord();

  const next: UserDataRecord = normalizeRecord({
    watchlist: patch.watchlist ?? current.watchlist,
    scanHistory: patch.scanHistory ?? current.scanHistory,
    comparisonHistory: patch.comparisonHistory ?? current.comparisonHistory,
    history: patch.history ?? current.history,
    alertEmail:
      patch.alertEmail === null || typeof patch.alertEmail === "string"
        ? patch.alertEmail
        : current.alertEmail,
    notificationOnGradeChange:
      typeof patch.notificationOnGradeChange === "boolean"
        ? patch.notificationOnGradeChange
        : current.notificationOnGradeChange,
    notificationFrequency: isNotificationFrequency(patch.notificationFrequency)
      ? patch.notificationFrequency
      : current.notificationFrequency,
    browserNotificationsEnabled:
      typeof patch.browserNotificationsEnabled === "boolean"
        ? patch.browserNotificationsEnabled
        : current.browserNotificationsEnabled,
    watchlistNotificationLog:
      patch.watchlistNotificationLog && typeof patch.watchlistNotificationLog === "object"
        ? normalizeWatchlistNotificationLog(patch.watchlistNotificationLog)
        : current.watchlistNotificationLog,
    webhooks: Array.isArray(patch.webhooks)
      ? normalizeWebhookRegistrations(patch.webhooks)
      : current.webhooks,
    apiKey:
      patch.apiKey === null
        ? null
        : isApiKey(patch.apiKey)
          ? patch.apiKey.trim()
          : current.apiKey,
    updatedAt: new Date().toISOString()
  });

  data.users[normalizedKey] = next;
  await writeDataFile(data);
  return next;
}

export async function deleteUserDataForUser(userKey: string): Promise<void> {
  const normalizedKey = normalizeUserKey(userKey);
  const data = await readDataFile();
  if (!data.users[normalizedKey]) {
    return;
  }
  delete data.users[normalizedKey];
  await writeDataFile(data);
}

export async function getUsersWithWatchlistData(): Promise<
  Array<{ userKey: string; data: UserDataRecord }>
> {
  const data = await readDataFile();
  const result: Array<{ userKey: string; data: UserDataRecord }> = [];

  for (const [userKey, record] of Object.entries(data.users)) {
    if (!userKey) continue;
    const normalized = normalizeRecord(record);
    const personalWatchlist = normalized.watchlist.filter((entry) => !entry.teamId);
    if (personalWatchlist.length === 0) continue;
    result.push({
      userKey,
      data: {
        ...normalized,
        watchlist: personalWatchlist
      }
    });
  }

  return result;
}

export async function getUserByApiKey(
  apiKey: string
): Promise<{ userKey: string; data: UserDataRecord } | null> {
  const trimmedApiKey = apiKey.trim();
  if (!isApiKey(trimmedApiKey)) {
    return null;
  }

  const data = await readDataFile();
  for (const [userKey, record] of Object.entries(data.users)) {
    const normalized = normalizeRecord(record);
    if (normalized.apiKey === trimmedApiKey) {
      return { userKey, data: normalized };
    }
  }

  return null;
}

export async function getUserProfilesByUserKeys(
  userKeys: string[]
): Promise<Record<string, UserProfileRecord>> {
  const normalizedKeys = Array.from(
    new Set(
      userKeys
        .map((value) => normalizeUserKey(value))
        .filter(Boolean)
    )
  );
  if (normalizedKeys.length === 0) {
    return {};
  }

  const data = await readDataFile();
  const profiles: Record<string, UserProfileRecord> = {};
  for (const userKey of normalizedKeys) {
    const displayName = deriveDisplayNameFromUserKey(userKey);
    const avatarInitials = deriveInitials(displayName);
    const stored = data.users[userKey];
    profiles[userKey] = {
      userKey,
      displayName,
      avatarInitials,
      avatarUrl: stored && typeof (stored as { avatarUrl?: unknown }).avatarUrl === "string"
        ? ((stored as { avatarUrl?: string }).avatarUrl ?? null)
        : null
    };
  }
  return profiles;
}
