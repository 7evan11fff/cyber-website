import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createEmptyUserDataRecord,
  type UserDataRecord,
  normalizeScanHistoryEntries,
  normalizeWatchlistEntries
} from "@/lib/userData";

type UserDataFile = {
  users: Record<string, UserDataRecord>;
};

const USER_DATA_FILE_PATH = path.join(process.cwd(), "data", "user-data.json");

function normalizeUserKey(input: string) {
  return input.trim().toLowerCase();
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
  return {
    watchlist: normalizeWatchlistEntries(record.watchlist),
    scanHistory: normalizeScanHistoryEntries(record.scanHistory),
    alertEmail: typeof record.alertEmail === "string" ? record.alertEmail : null,
    notificationOnGradeChange: Boolean(record.notificationOnGradeChange),
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
    Pick<UserDataRecord, "watchlist" | "scanHistory" | "alertEmail" | "notificationOnGradeChange">
  >
): Promise<UserDataRecord> {
  const normalizedKey = normalizeUserKey(userKey);
  const data = await readDataFile();
  const current = data.users[normalizedKey] ?? createEmptyUserDataRecord();

  const next: UserDataRecord = normalizeRecord({
    watchlist: patch.watchlist ?? current.watchlist,
    scanHistory: patch.scanHistory ?? current.scanHistory,
    alertEmail:
      patch.alertEmail === null || typeof patch.alertEmail === "string"
        ? patch.alertEmail
        : current.alertEmail,
    notificationOnGradeChange:
      typeof patch.notificationOnGradeChange === "boolean"
        ? patch.notificationOnGradeChange
        : current.notificationOnGradeChange,
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
