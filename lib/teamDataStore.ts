import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeTargetUrl } from "@/lib/securityReport";
import {
  createEmptyTeamDataFile,
  createTeamSlug,
  normalizeEmail,
  normalizeTeamRole,
  normalizeTeamSlug,
  normalizeTeamWatchlistEntries,
  normalizeUserId,
  roleRank,
  type TeamDataFile,
  type TeamInviteRecord,
  type TeamMemberRecord,
  type TeamRecord,
  type TeamRole,
  type TeamScanActivityRecord,
  type TeamWatchlistActivityRecord,
  type TeamWatchlistEntry
} from "@/lib/teamData";

const TEAM_DATA_FILE_PATH = path.join(process.cwd(), "data", "team-data.json");
const DEFAULT_INVITE_EXPIRY_DAYS = 7;
const MAX_SCAN_ACTIVITY_PER_TEAM = 400;
const MAX_WATCHLIST_ACTIVITY_PER_TEAM = 240;

export type TeamSummary = TeamRecord & {
  role: TeamRole;
  memberCount: number;
  pendingInviteCount: number;
};

export type TeamSnapshot = {
  team: TeamSummary;
  viewerUserId: string;
  members: TeamMemberRecord[];
  invites: TeamInviteRecord[];
  watchlist: TeamWatchlistEntry[];
  scanActivity: TeamScanActivityRecord[];
  watchlistActivity: TeamWatchlistActivityRecord[];
};

export type InviteAcceptanceResult =
  | { ok: true; teamSlug: string }
  | { ok: false; reason: "not_found" | "expired" | "already_accepted" | "email_mismatch" };

function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp);
}

function normalizeTeamRecord(value: unknown): TeamRecord | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<TeamRecord>;
  if (typeof candidate.id !== "string" || !candidate.id.trim()) return null;
  if (typeof candidate.name !== "string" || !candidate.name.trim()) return null;
  if (typeof candidate.slug !== "string" || !candidate.slug.trim()) return null;
  if (!isValidIsoTimestamp(candidate.createdAt)) return null;
  if (typeof candidate.ownerId !== "string" || !candidate.ownerId.trim()) return null;
  return {
    id: candidate.id,
    name: candidate.name.trim(),
    slug: normalizeTeamSlug(candidate.slug) || createTeamSlug(candidate.name),
    createdAt: new Date(candidate.createdAt).toISOString(),
    ownerId: normalizeUserId(candidate.ownerId)
  };
}

function normalizeTeamMemberRecord(value: unknown): TeamMemberRecord | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<TeamMemberRecord>;
  if (typeof candidate.teamId !== "string" || !candidate.teamId.trim()) return null;
  if (typeof candidate.userId !== "string" || !candidate.userId.trim()) return null;
  if (!isValidIsoTimestamp(candidate.invitedAt)) return null;
  if (!isValidIsoTimestamp(candidate.joinedAt)) return null;
  return {
    teamId: candidate.teamId.trim(),
    userId: normalizeUserId(candidate.userId),
    role: normalizeTeamRole(candidate.role, "member"),
    invitedAt: new Date(candidate.invitedAt).toISOString(),
    joinedAt: new Date(candidate.joinedAt).toISOString()
  };
}

function normalizeTeamInviteRecord(value: unknown): TeamInviteRecord | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<TeamInviteRecord>;
  if (typeof candidate.id !== "string" || !candidate.id.trim()) return null;
  if (typeof candidate.teamId !== "string" || !candidate.teamId.trim()) return null;
  if (typeof candidate.email !== "string" || !candidate.email.trim()) return null;
  if (typeof candidate.token !== "string" || !candidate.token.trim()) return null;
  if (!isValidIsoTimestamp(candidate.expiresAt)) return null;
  if (candidate.acceptedAt !== null && !isValidIsoTimestamp(candidate.acceptedAt)) return null;
  if (!isValidIsoTimestamp(candidate.createdAt)) return null;
  if (typeof candidate.invitedByUserId !== "string" || !candidate.invitedByUserId.trim()) return null;
  return {
    id: candidate.id,
    teamId: candidate.teamId.trim(),
    email: normalizeEmail(candidate.email),
    token: candidate.token.trim(),
    expiresAt: new Date(candidate.expiresAt).toISOString(),
    acceptedAt: candidate.acceptedAt ? new Date(candidate.acceptedAt).toISOString() : null,
    createdAt: new Date(candidate.createdAt).toISOString(),
    invitedByUserId: normalizeUserId(candidate.invitedByUserId)
  };
}

function normalizeTeamScanActivityRecord(value: unknown): TeamScanActivityRecord | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<TeamScanActivityRecord>;
  if (typeof candidate.id !== "string" || !candidate.id.trim()) return null;
  if (typeof candidate.teamId !== "string" || !candidate.teamId.trim()) return null;
  if (candidate.entryId !== null && typeof candidate.entryId !== "string") return null;
  if (typeof candidate.url !== "string" || !candidate.url.trim()) return null;
  if (typeof candidate.grade !== "string" || !candidate.grade.trim()) return null;
  if (!isValidIsoTimestamp(candidate.scannedAt)) return null;
  if (typeof candidate.scannedByUserId !== "string" || !candidate.scannedByUserId.trim()) return null;
  return {
    id: candidate.id,
    teamId: candidate.teamId.trim(),
    entryId: candidate.entryId ?? null,
    url: candidate.url.trim(),
    grade: candidate.grade.trim().toUpperCase(),
    scannedAt: new Date(candidate.scannedAt).toISOString(),
    scannedByUserId: normalizeUserId(candidate.scannedByUserId)
  };
}

function normalizeTeamWatchlistActivityRecord(value: unknown): TeamWatchlistActivityRecord | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<TeamWatchlistActivityRecord>;
  if (typeof candidate.id !== "string" || !candidate.id.trim()) return null;
  if (typeof candidate.teamId !== "string" || !candidate.teamId.trim()) return null;
  if (candidate.entryId !== null && typeof candidate.entryId !== "string") return null;
  if (typeof candidate.url !== "string" || !candidate.url.trim()) return null;
  if (candidate.action !== "added" && candidate.action !== "removed") return null;
  if (!isValidIsoTimestamp(candidate.occurredAt)) return null;
  if (typeof candidate.actorUserId !== "string" || !candidate.actorUserId.trim()) return null;
  return {
    id: candidate.id,
    teamId: candidate.teamId.trim(),
    entryId: candidate.entryId ?? null,
    url: candidate.url.trim(),
    action: candidate.action,
    occurredAt: new Date(candidate.occurredAt).toISOString(),
    actorUserId: normalizeUserId(candidate.actorUserId)
  };
}

function normalizeDataFile(value: unknown): TeamDataFile {
  if (!value || typeof value !== "object") {
    return createEmptyTeamDataFile();
  }

  const parsed = value as Partial<TeamDataFile>;
  const teams = Array.isArray(parsed.teams)
    ? parsed.teams
        .map(normalizeTeamRecord)
        .filter((team): team is TeamRecord => Boolean(team))
    : [];
  const teamIdSet = new Set(teams.map((team) => team.id));
  const teamMembers = Array.isArray(parsed.teamMembers)
    ? parsed.teamMembers
        .map(normalizeTeamMemberRecord)
        .filter((member): member is TeamMemberRecord => Boolean(member && teamIdSet.has(member.teamId)))
    : [];
  const teamInvites = Array.isArray(parsed.teamInvites)
    ? parsed.teamInvites
        .map(normalizeTeamInviteRecord)
        .filter((invite): invite is TeamInviteRecord => Boolean(invite && teamIdSet.has(invite.teamId)))
    : [];
  const teamWatchlist = Array.isArray(parsed.teamWatchlist)
    ? normalizeTeamWatchlistEntries(parsed.teamWatchlist).filter((entry) => teamIdSet.has(entry.teamId))
    : [];
  const teamScanActivity = Array.isArray(parsed.teamScanActivity)
    ? parsed.teamScanActivity
        .map(normalizeTeamScanActivityRecord)
        .filter((activity): activity is TeamScanActivityRecord => Boolean(activity && teamIdSet.has(activity.teamId)))
    : [];
  const teamWatchlistActivity = Array.isArray(parsed.teamWatchlistActivity)
    ? parsed.teamWatchlistActivity
        .map(normalizeTeamWatchlistActivityRecord)
        .filter(
          (activity): activity is TeamWatchlistActivityRecord =>
            Boolean(activity && teamIdSet.has(activity.teamId))
        )
    : [];

  return {
    teams,
    teamMembers,
    teamInvites,
    teamWatchlist,
    teamScanActivity,
    teamWatchlistActivity
  };
}

async function ensureDataFile(): Promise<void> {
  await mkdir(path.dirname(TEAM_DATA_FILE_PATH), { recursive: true });
  try {
    await readFile(TEAM_DATA_FILE_PATH, "utf8");
  } catch {
    await writeFile(TEAM_DATA_FILE_PATH, JSON.stringify(createEmptyTeamDataFile(), null, 2), "utf8");
  }
}

async function readDataFile(): Promise<TeamDataFile> {
  await ensureDataFile();
  try {
    const raw = await readFile(TEAM_DATA_FILE_PATH, "utf8");
    return normalizeDataFile(JSON.parse(raw));
  } catch {
    return createEmptyTeamDataFile();
  }
}

async function writeDataFile(data: TeamDataFile): Promise<void> {
  await ensureDataFile();
  await writeFile(TEAM_DATA_FILE_PATH, JSON.stringify(data, null, 2), "utf8");
}

async function mutateDataFile<T>(mutate: (data: TeamDataFile) => T | Promise<T>): Promise<T> {
  const data = await readDataFile();
  const result = await mutate(data);
  await writeDataFile(data);
  return result;
}

function ensureValidTeamName(name: string): string {
  const normalized = name.trim();
  if (normalized.length < 2 || normalized.length > 80) {
    throw new Error("Team name must be between 2 and 80 characters.");
  }
  return normalized;
}

function ensureUniqueSlug(data: TeamDataFile, baseSlug: string): string {
  const normalizedBase = normalizeTeamSlug(baseSlug) || "team";
  const existing = new Set(data.teams.map((team) => team.slug));
  if (!existing.has(normalizedBase)) return normalizedBase;
  let index = 2;
  while (existing.has(`${normalizedBase}-${index}`)) {
    index += 1;
  }
  return `${normalizedBase}-${index}`;
}

function getMembership(data: TeamDataFile, teamId: string, userId: string): TeamMemberRecord | null {
  return data.teamMembers.find((member) => member.teamId === teamId && member.userId === userId) ?? null;
}

function getTeamBySlug(data: TeamDataFile, slug: string): TeamRecord | null {
  const normalizedSlug = normalizeTeamSlug(slug);
  if (!normalizedSlug) return null;
  return data.teams.find((team) => team.slug === normalizedSlug) ?? null;
}

function sortMembers(members: TeamMemberRecord[]): TeamMemberRecord[] {
  return [...members].sort((a, b) => {
    const rankDiff = roleRank(b.role) - roleRank(a.role);
    if (rankDiff !== 0) return rankDiff;
    return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
  });
}

function buildTeamSummary(data: TeamDataFile, team: TeamRecord, role: TeamRole): TeamSummary {
  const memberCount = data.teamMembers.filter((member) => member.teamId === team.id).length;
  const pendingInviteCount = data.teamInvites.filter(
    (invite) =>
      invite.teamId === team.id &&
      invite.acceptedAt === null &&
      new Date(invite.expiresAt).getTime() > Date.now()
  ).length;
  return {
    ...team,
    role,
    memberCount,
    pendingInviteCount
  };
}

function requireManagerRole(role: TeamRole) {
  if (roleRank(role) < roleRank("admin")) {
    throw new Error("Only team owner/admin can perform this action.");
  }
}

function inviteToken() {
  return randomBytes(24).toString("hex");
}

function validateInviteEmail(email: string): string {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Please enter a valid email address.");
  }
  return normalized;
}

function resolveActorTeam(data: TeamDataFile, slug: string, actorUserId: string) {
  const team = getTeamBySlug(data, slug);
  if (!team) {
    throw new Error("Team not found.");
  }
  const actor = getMembership(data, team.id, normalizeUserId(actorUserId));
  if (!actor) {
    throw new Error("Forbidden.");
  }
  return { team, actor };
}

function recordTeamScanActivity(input: {
  data: TeamDataFile;
  teamId: string;
  entryId: string | null;
  url: string;
  grade: string;
  scannedAt: string;
  scannedByUserId: string;
}): TeamScanActivityRecord {
  const activity: TeamScanActivityRecord = {
    id: randomUUID(),
    teamId: input.teamId,
    entryId: input.entryId,
    url: input.url,
    grade: input.grade.trim().toUpperCase(),
    scannedAt: new Date(input.scannedAt).toISOString(),
    scannedByUserId: normalizeUserId(input.scannedByUserId)
  };
  input.data.teamScanActivity.push(activity);
  const teamItems = input.data.teamScanActivity
    .filter((candidate) => candidate.teamId === input.teamId)
    .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime())
    .slice(0, MAX_SCAN_ACTIVITY_PER_TEAM);
  input.data.teamScanActivity = [
    ...input.data.teamScanActivity.filter((candidate) => candidate.teamId !== input.teamId),
    ...teamItems
  ];
  return activity;
}

function recordTeamWatchlistActivity(input: {
  data: TeamDataFile;
  teamId: string;
  entryId: string | null;
  url: string;
  action: TeamWatchlistActivityRecord["action"];
  occurredAt?: string;
  actorUserId: string;
}): TeamWatchlistActivityRecord {
  const activity: TeamWatchlistActivityRecord = {
    id: randomUUID(),
    teamId: input.teamId,
    entryId: input.entryId,
    url: input.url,
    action: input.action,
    occurredAt: new Date(input.occurredAt ?? new Date().toISOString()).toISOString(),
    actorUserId: normalizeUserId(input.actorUserId)
  };
  input.data.teamWatchlistActivity.push(activity);
  const teamItems = input.data.teamWatchlistActivity
    .filter((candidate) => candidate.teamId === input.teamId)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, MAX_WATCHLIST_ACTIVITY_PER_TEAM);
  input.data.teamWatchlistActivity = [
    ...input.data.teamWatchlistActivity.filter((candidate) => candidate.teamId !== input.teamId),
    ...teamItems
  ];
  return activity;
}

export async function listTeamsForUser(userId: string): Promise<TeamSummary[]> {
  const normalizedUserId = normalizeUserId(userId);
  const data = await readDataFile();
  const memberships = data.teamMembers.filter((member) => member.userId === normalizedUserId);
  const summaries = memberships
    .map((membership) => {
      const team = data.teams.find((candidate) => candidate.id === membership.teamId);
      if (!team) return null;
      return buildTeamSummary(data, team, membership.role);
    })
    .filter((summary): summary is TeamSummary => Boolean(summary));

  return summaries.sort((a, b) => {
    const rankDiff = roleRank(b.role) - roleRank(a.role);
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  });
}

export async function createTeamForUser(input: { userId: string; name: string }): Promise<TeamSummary> {
  const normalizedOwnerId = normalizeUserId(input.userId);
  const name = ensureValidTeamName(input.name);

  return mutateDataFile((data) => {
    const createdAt = new Date().toISOString();
    const team: TeamRecord = {
      id: randomUUID(),
      name,
      slug: ensureUniqueSlug(data, createTeamSlug(name)),
      createdAt,
      ownerId: normalizedOwnerId
    };
    const ownerMembership: TeamMemberRecord = {
      teamId: team.id,
      userId: normalizedOwnerId,
      role: "owner",
      invitedAt: createdAt,
      joinedAt: createdAt
    };
    data.teams.push(team);
    data.teamMembers.push(ownerMembership);
    return buildTeamSummary(data, team, "owner");
  });
}

export async function getTeamSnapshotBySlugForUser(input: {
  slug: string;
  userId: string;
  includeInvites?: boolean;
}): Promise<TeamSnapshot | null> {
  const normalizedUserId = normalizeUserId(input.userId);
  const data = await readDataFile();
  const team = getTeamBySlug(data, input.slug);
  if (!team) return null;
  const membership = getMembership(data, team.id, normalizedUserId);
  if (!membership) return null;

  const members = sortMembers(data.teamMembers.filter((member) => member.teamId === team.id));
  const invites =
    input.includeInvites && roleRank(membership.role) >= roleRank("admin")
      ? data.teamInvites
          .filter((invite) => invite.teamId === team.id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      : [];
  const watchlist = data.teamWatchlist
    .filter((entry) => entry.teamId === team.id)
    .sort((a, b) => new Date(b.lastCheckedAt).getTime() - new Date(a.lastCheckedAt).getTime());
  const scanActivity = data.teamScanActivity
    .filter((activity) => activity.teamId === team.id)
    .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime())
    .slice(0, MAX_SCAN_ACTIVITY_PER_TEAM);
  const watchlistActivity = data.teamWatchlistActivity
    .filter((activity) => activity.teamId === team.id)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, MAX_WATCHLIST_ACTIVITY_PER_TEAM);

  return {
    team: buildTeamSummary(data, team, membership.role),
    viewerUserId: membership.userId,
    members,
    invites,
    watchlist,
    scanActivity,
    watchlistActivity
  };
}

export async function renameTeamBySlug(input: {
  slug: string;
  actorUserId: string;
  name: string;
}): Promise<TeamRecord> {
  const newName = ensureValidTeamName(input.name);
  return mutateDataFile((data) => {
    const { team, actor } = resolveActorTeam(data, input.slug, input.actorUserId);
    requireManagerRole(actor.role);
    const teamIndex = data.teams.findIndex((candidate) => candidate.id === team.id);
    const nextTeam: TeamRecord = { ...team, name: newName };
    data.teams[teamIndex] = nextTeam;
    return nextTeam;
  });
}

export async function inviteUserToTeamBySlug(input: {
  slug: string;
  actorUserId: string;
  email: string;
  expiresInDays?: number;
  resend?: boolean;
}): Promise<TeamInviteRecord> {
  const requestedEmail = validateInviteEmail(input.email);
  const expiresInDays = Math.max(1, Math.min(input.expiresInDays ?? DEFAULT_INVITE_EXPIRY_DAYS, 30));

  return mutateDataFile((data) => {
    const { team, actor } = resolveActorTeam(data, input.slug, input.actorUserId);
    requireManagerRole(actor.role);
    const now = new Date();
    if (data.teamMembers.some((member) => member.teamId === team.id && member.userId === requestedEmail)) {
      throw new Error("That user is already a team member.");
    }

    const pendingInvite = data.teamInvites.find(
      (invite) =>
        invite.teamId === team.id &&
        invite.email === requestedEmail &&
        invite.acceptedAt === null &&
        new Date(invite.expiresAt).getTime() > Date.now()
    );
    if (pendingInvite) {
      if (input.resend) {
        const refreshed: TeamInviteRecord = {
          ...pendingInvite,
          token: inviteToken(),
          createdAt: now.toISOString(),
          invitedByUserId: normalizeUserId(input.actorUserId),
          expiresAt: new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        };
        const index = data.teamInvites.findIndex((invite) => invite.id === pendingInvite.id);
        if (index >= 0) {
          data.teamInvites[index] = refreshed;
        }
        return refreshed;
      }
      return pendingInvite;
    }

    const invite: TeamInviteRecord = {
      id: randomUUID(),
      teamId: team.id,
      email: requestedEmail,
      token: inviteToken(),
      createdAt: now.toISOString(),
      invitedByUserId: normalizeUserId(input.actorUserId),
      expiresAt: new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
      acceptedAt: null
    };
    data.teamInvites.push(invite);
    return invite;
  });
}

export async function updateTeamMemberRoleBySlug(input: {
  slug: string;
  actorUserId: string;
  targetUserId: string;
  role: TeamRole;
}): Promise<TeamMemberRecord> {
  return mutateDataFile((data) => {
    const { team, actor } = resolveActorTeam(data, input.slug, input.actorUserId);
    const nextRole = normalizeTeamRole(input.role, "member");
    const targetUserId = normalizeUserId(input.targetUserId);
    const targetIndex = data.teamMembers.findIndex(
      (member) => member.teamId === team.id && member.userId === targetUserId
    );
    if (targetIndex < 0) {
      throw new Error("Team member not found.");
    }
    const target = data.teamMembers[targetIndex];
    if (target.userId === actor.userId) {
      throw new Error("You cannot change your own role.");
    }
    if (target.role === "owner" || nextRole === "owner") {
      throw new Error("Only owner-level role management is supported for ownership changes.");
    }

    if (actor.role === "admin") {
      if (target.role !== "member") {
        throw new Error("Admins can only manage members.");
      }
      if (nextRole === "admin") {
        throw new Error("Admins cannot promote other users to admin.");
      }
    } else if (actor.role !== "owner") {
      throw new Error("Only owner/admin can manage team roles.");
    }

    const nextMember: TeamMemberRecord = {
      ...target,
      role: nextRole
    };
    data.teamMembers[targetIndex] = nextMember;
    return nextMember;
  });
}

export async function removeTeamMemberBySlug(input: {
  slug: string;
  actorUserId: string;
  targetUserId: string;
}): Promise<boolean> {
  return mutateDataFile((data) => {
    const { team, actor } = resolveActorTeam(data, input.slug, input.actorUserId);
    const targetUserId = normalizeUserId(input.targetUserId);
    const targetIndex = data.teamMembers.findIndex(
      (member) => member.teamId === team.id && member.userId === targetUserId
    );
    if (targetIndex < 0) {
      throw new Error("Team member not found.");
    }

    const target = data.teamMembers[targetIndex];
    if (target.role === "owner") {
      throw new Error("Team owner cannot be removed.");
    }

    if (actor.userId === targetUserId) {
      if (actor.role === "owner") {
        throw new Error("Team owner cannot leave the team. Delete the team or transfer ownership first.");
      }
    } else if (actor.role === "admin") {
      if (target.role !== "member") {
        throw new Error("Admins can only remove members.");
      }
    } else if (actor.role !== "owner") {
      throw new Error("Only team owner/admin can remove members.");
    }

    data.teamMembers.splice(targetIndex, 1);
    return true;
  });
}

export async function leaveTeamBySlug(input: { slug: string; actorUserId: string }): Promise<boolean> {
  return removeTeamMemberBySlug({
    slug: input.slug,
    actorUserId: input.actorUserId,
    targetUserId: input.actorUserId
  });
}

export async function deleteTeamBySlug(input: { slug: string; actorUserId: string }): Promise<boolean> {
  return mutateDataFile((data) => {
    const { team, actor } = resolveActorTeam(data, input.slug, input.actorUserId);
    if (actor.role !== "owner") {
      throw new Error("Only team owner can delete the team.");
    }

    data.teams = data.teams.filter((candidate) => candidate.id !== team.id);
    data.teamMembers = data.teamMembers.filter((member) => member.teamId !== team.id);
    data.teamInvites = data.teamInvites.filter((invite) => invite.teamId !== team.id);
    data.teamWatchlist = data.teamWatchlist.filter((entry) => entry.teamId !== team.id);
    data.teamScanActivity = data.teamScanActivity.filter((activity) => activity.teamId !== team.id);
    data.teamWatchlistActivity = data.teamWatchlistActivity.filter((activity) => activity.teamId !== team.id);
    return true;
  });
}

export async function acceptTeamInvite(input: {
  token: string;
  acceptingUserId: string;
  acceptingEmail: string;
}): Promise<InviteAcceptanceResult> {
  const token = input.token.trim();
  if (!token) {
    return { ok: false, reason: "not_found" };
  }

  const acceptingUserId = normalizeUserId(input.acceptingUserId);
  const acceptingEmail = normalizeEmail(input.acceptingEmail);
  if (!acceptingEmail) {
    return { ok: false, reason: "email_mismatch" };
  }

  return mutateDataFile((data) => {
    const inviteIndex = data.teamInvites.findIndex((invite) => invite.token === token);
    if (inviteIndex < 0) {
      return { ok: false, reason: "not_found" } as InviteAcceptanceResult;
    }

    const invite = data.teamInvites[inviteIndex];
    const now = new Date();
    if (invite.email !== acceptingEmail) {
      return { ok: false, reason: "email_mismatch" } as InviteAcceptanceResult;
    }
    if (invite.acceptedAt) {
      return { ok: false, reason: "already_accepted" } as InviteAcceptanceResult;
    }
    if (new Date(invite.expiresAt).getTime() <= now.getTime()) {
      return { ok: false, reason: "expired" } as InviteAcceptanceResult;
    }

    const existingMemberIndex = data.teamMembers.findIndex(
      (member) => member.teamId === invite.teamId && member.userId === acceptingUserId
    );
    if (existingMemberIndex >= 0) {
      const existing = data.teamMembers[existingMemberIndex];
      data.teamMembers[existingMemberIndex] = {
        ...existing,
        joinedAt: existing.joinedAt || now.toISOString()
      };
    } else {
      data.teamMembers.push({
        teamId: invite.teamId,
        userId: acceptingUserId,
        role: "member",
        invitedAt: invite.createdAt,
        joinedAt: now.toISOString()
      });
    }

    data.teamInvites[inviteIndex] = {
      ...invite,
      acceptedAt: now.toISOString()
    };

    const team = data.teams.find((candidate) => candidate.id === invite.teamId);
    if (!team) {
      return { ok: false, reason: "not_found" } as InviteAcceptanceResult;
    }

    return { ok: true, teamSlug: team.slug } as InviteAcceptanceResult;
  });
}

export async function addOrUpdateTeamWatchlistEntryBySlug(input: {
  slug: string;
  actorUserId: string;
  url: string;
  grade: string;
  checkedAt: string;
}): Promise<{ entry: TeamWatchlistEntry; activity: TeamScanActivityRecord }> {
  return mutateDataFile((data) => {
    const { team } = resolveActorTeam(data, input.slug, input.actorUserId);
    const actorUserId = normalizeUserId(input.actorUserId);
    const checkedAt = new Date(input.checkedAt).toISOString();
    const normalizedUrl = normalizeTargetUrl(input.url);
    const currentGrade = input.grade.trim().toUpperCase();
    const existingIndex = data.teamWatchlist.findIndex(
      (entry) => entry.teamId === team.id && entry.url.toLowerCase() === normalizedUrl.toLowerCase()
    );
    if (existingIndex >= 0) {
      const existing = data.teamWatchlist[existingIndex];
      const changed = existing.lastGrade !== currentGrade;
      const nextEntry: TeamWatchlistEntry = {
        ...existing,
        url: normalizedUrl,
        lastGrade: currentGrade,
        previousGrade: changed ? existing.lastGrade : null,
        lastCheckedAt: checkedAt,
        lastScannedByUserId: actorUserId
      };
      data.teamWatchlist[existingIndex] = nextEntry;
      const activity = recordTeamScanActivity({
        data,
        teamId: team.id,
        entryId: nextEntry.id,
        url: nextEntry.url,
        grade: nextEntry.lastGrade,
        scannedAt: nextEntry.lastCheckedAt,
        scannedByUserId: actorUserId
      });
      return { entry: nextEntry, activity };
    }

    const now = new Date().toISOString();
    const created: TeamWatchlistEntry = {
      id: randomUUID(),
      teamId: team.id,
      url: normalizedUrl,
      lastGrade: currentGrade,
      previousGrade: null,
      lastCheckedAt: checkedAt,
      createdAt: now,
      createdByUserId: actorUserId,
      lastScannedByUserId: actorUserId
    };
    data.teamWatchlist.push(created);
    recordTeamWatchlistActivity({
      data,
      teamId: team.id,
      entryId: created.id,
      url: created.url,
      action: "added",
      occurredAt: now,
      actorUserId
    });
    const activity = recordTeamScanActivity({
      data,
      teamId: team.id,
      entryId: created.id,
      url: created.url,
      grade: created.lastGrade,
      scannedAt: created.lastCheckedAt,
      scannedByUserId: actorUserId
    });
    return { entry: created, activity };
  });
}

export async function removeTeamWatchlistEntryBySlug(input: {
  slug: string;
  actorUserId: string;
  entryId: string;
}): Promise<{ removed: boolean; activity: TeamWatchlistActivityRecord | null }> {
  return mutateDataFile((data) => {
    const { team } = resolveActorTeam(data, input.slug, input.actorUserId);
    const actorUserId = normalizeUserId(input.actorUserId);
    const target = data.teamWatchlist.find((entry) => entry.teamId === team.id && entry.id === input.entryId) ?? null;
    if (!target) {
      return { removed: false, activity: null };
    }
    data.teamWatchlist = data.teamWatchlist.filter(
      (entry) => !(entry.teamId === team.id && entry.id === input.entryId)
    );
    const activity = recordTeamWatchlistActivity({
      data,
      teamId: team.id,
      entryId: target.id,
      url: target.url,
      action: "removed",
      actorUserId
    });
    return { removed: true, activity };
  });
}

export async function listTeamWatchlistBySlugForUser(input: {
  slug: string;
  userId: string;
}): Promise<TeamWatchlistEntry[]> {
  const snapshot = await getTeamSnapshotBySlugForUser({
    slug: input.slug,
    userId: input.userId,
    includeInvites: false
  });
  if (!snapshot) {
    throw new Error("Forbidden.");
  }
  return snapshot.watchlist;
}

export async function getInviteByToken(token: string): Promise<TeamInviteRecord | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const data = await readDataFile();
  return data.teamInvites.find((invite) => invite.token === trimmed) ?? null;
}

export async function getTeamWatchlistWorkloads(): Promise<
  Array<{
    team: TeamRecord;
    members: TeamMemberRecord[];
    watchlist: TeamWatchlistEntry[];
  }>
> {
  const data = await readDataFile();
  const result: Array<{
    team: TeamRecord;
    members: TeamMemberRecord[];
    watchlist: TeamWatchlistEntry[];
  }> = [];

  for (const team of data.teams) {
    const watchlist = data.teamWatchlist.filter((entry) => entry.teamId === team.id);
    if (watchlist.length === 0) continue;
    const members = data.teamMembers.filter((member) => member.teamId === team.id);
    if (members.length === 0) continue;
    result.push({ team, members, watchlist });
  }

  return result;
}

export async function replaceTeamWatchlistEntries(
  teamId: string,
  watchlist: TeamWatchlistEntry[]
): Promise<void> {
  await mutateDataFile((data) => {
    data.teamWatchlist = [
      ...data.teamWatchlist.filter((entry) => entry.teamId !== teamId),
      ...watchlist.filter((entry) => entry.teamId === teamId)
    ];
  });
}
