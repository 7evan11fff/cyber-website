import { randomUUID } from "node:crypto";
import { normalizeTargetUrl } from "@/lib/securityReport";

export const TEAM_ROLES = ["owner", "admin", "member"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export type TeamRecord = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  ownerId: string;
};

export type TeamMemberRecord = {
  teamId: string;
  userId: string;
  role: TeamRole;
  invitedAt: string;
  joinedAt: string;
};

export type TeamInviteRecord = {
  id: string;
  teamId: string;
  email: string;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  invitedByUserId: string;
};

export type TeamWatchlistEntry = {
  id: string;
  teamId: string;
  url: string;
  lastGrade: string;
  previousGrade: string | null;
  lastCheckedAt: string;
  createdAt: string;
  createdByUserId: string;
  lastScannedByUserId: string;
};

export type TeamScanActivityRecord = {
  id: string;
  teamId: string;
  entryId: string | null;
  url: string;
  grade: string;
  scannedAt: string;
  scannedByUserId: string;
};

export type TeamWatchlistActivityRecord = {
  id: string;
  teamId: string;
  entryId: string | null;
  url: string;
  action: "added" | "removed";
  occurredAt: string;
  actorUserId: string;
};

export type TeamDataFile = {
  teams: TeamRecord[];
  teamMembers: TeamMemberRecord[];
  teamInvites: TeamInviteRecord[];
  teamWatchlist: TeamWatchlistEntry[];
  teamScanActivity: TeamScanActivityRecord[];
  teamWatchlistActivity: TeamWatchlistActivityRecord[];
};

export function createEmptyTeamDataFile(): TeamDataFile {
  return {
    teams: [],
    teamMembers: [],
    teamInvites: [],
    teamWatchlist: [],
    teamScanActivity: [],
    teamWatchlistActivity: []
  };
}

export function isTeamRole(value: unknown): value is TeamRole {
  return typeof value === "string" && (TEAM_ROLES as readonly string[]).includes(value);
}

export function normalizeUserId(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeTeamSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export function createTeamSlug(name: string): string {
  const fromName = normalizeTeamSlug(name);
  if (fromName) return fromName;
  return `team-${randomUUID().slice(0, 8)}`;
}

export function normalizeTeamRole(value: unknown, fallback: TeamRole = "member"): TeamRole {
  return isTeamRole(value) ? value : fallback;
}

function normalizeGrade(value: unknown): string {
  if (typeof value !== "string") return "F";
  const normalized = value.trim().toUpperCase();
  return /^[A-F]$/.test(normalized) ? normalized : "F";
}

function normalizeIsoTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return fallback;
  return new Date(timestamp).toISOString();
}

export function normalizeTeamWatchlistEntries(entries: unknown[]): TeamWatchlistEntry[] {
  const deduped = new Map<string, TeamWatchlistEntry>();
  for (const candidate of entries) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as Partial<TeamWatchlistEntry>;
    if (typeof entry.id !== "string") continue;
    if (typeof entry.teamId !== "string" || !entry.teamId.trim()) continue;
    if (typeof entry.createdByUserId !== "string" || !entry.createdByUserId.trim()) continue;

    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeTargetUrl(String(entry.url ?? ""));
    } catch {
      continue;
    }

    const normalizedEntry: TeamWatchlistEntry = {
      id: entry.id,
      teamId: entry.teamId.trim(),
      url: normalizedUrl,
      lastGrade: normalizeGrade(entry.lastGrade),
      previousGrade:
        entry.previousGrade === null
          ? null
          : typeof entry.previousGrade === "string"
            ? normalizeGrade(entry.previousGrade)
            : null,
      lastCheckedAt: normalizeIsoTimestamp(entry.lastCheckedAt, new Date(0).toISOString()),
      createdAt: normalizeIsoTimestamp(entry.createdAt, new Date(0).toISOString()),
      createdByUserId: normalizeUserId(entry.createdByUserId),
      lastScannedByUserId:
        typeof entry.lastScannedByUserId === "string" && entry.lastScannedByUserId.trim()
          ? normalizeUserId(entry.lastScannedByUserId)
          : normalizeUserId(entry.createdByUserId)
    };
    deduped.set(`${normalizedEntry.teamId}:${normalizedEntry.url.toLowerCase()}`, normalizedEntry);
  }

  return Array.from(deduped.values()).sort(
    (a, b) => new Date(b.lastCheckedAt).getTime() - new Date(a.lastCheckedAt).getTime()
  );
}

export function roleRank(role: TeamRole): number {
  if (role === "owner") return 3;
  if (role === "admin") return 2;
  return 1;
}
