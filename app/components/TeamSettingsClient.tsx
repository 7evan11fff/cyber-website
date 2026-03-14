"use client";

import { useMemo, useState } from "react";

type TeamRole = "owner" | "admin" | "member";

type TeamSnapshot = {
  team: {
    id: string;
    name: string;
    slug: string;
    role: TeamRole;
    memberCount: number;
    pendingInviteCount: number;
  };
  members: Array<{
    teamId: string;
    userId: string;
    role: TeamRole;
    invitedAt: string;
    joinedAt: string;
  }>;
  invites: Array<{
    id: string;
    teamId: string;
    email: string;
    token: string;
    expiresAt: string;
    acceptedAt: string | null;
    createdAt: string;
    invitedByUserId: string;
  }>;
  memberProfiles: Record<
    string,
    {
      userKey: string;
      displayName: string;
      avatarInitials: string;
      avatarUrl: string | null;
    }
  >;
};

function canManageTeam(role: TeamRole) {
  return role === "owner" || role === "admin";
}

function inviteStatus(invite: TeamSnapshot["invites"][number]): "pending" | "accepted" | "expired" {
  if (invite.acceptedAt) return "accepted";
  if (new Date(invite.expiresAt).getTime() <= Date.now()) return "expired";
  return "pending";
}

export function TeamSettingsClient({
  slug,
  initialSnapshot
}: {
  slug: string;
  initialSnapshot: TeamSnapshot;
}) {
  const [teamName, setTeamName] = useState(initialSnapshot.team.name);
  const [members, setMembers] = useState(initialSnapshot.members);
  const [invites, setInvites] = useState(initialSnapshot.invites);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteState, setInviteState] = useState<"idle" | "saving">("idle");
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nameSaveState, setNameSaveState] = useState<"idle" | "saving">("idle");
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const sortedMembers = useMemo(() => {
    const rank: Record<TeamRole, number> = { owner: 3, admin: 2, member: 1 };
    return [...members].sort((a, b) => {
      const roleDiff = rank[b.role] - rank[a.role];
      if (roleDiff !== 0) return roleDiff;
      return a.userId.localeCompare(b.userId);
    });
  }, [members]);

  const managementEnabled = canManageTeam(initialSnapshot.team.role);

  async function saveName() {
    if (!managementEnabled || nameSaveState === "saving") return;
    setErrorMessage(null);
    setStatusMessage(null);
    setNameSaveState("saving");
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName })
      });
      const payload = (await response.json().catch(() => null)) as { team?: { name?: string }; error?: string } | null;
      if (!response.ok || !payload?.team?.name) {
        throw new Error(payload?.error ?? "Could not update team name.");
      }
      setTeamName(payload.team.name);
      setStatusMessage("Team name updated.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not update team name.");
    } finally {
      setNameSaveState("idle");
    }
  }

  async function inviteMember() {
    if (!managementEnabled || !inviteEmail.trim() || inviteState === "saving") return;
    setInviteState("saving");
    setErrorMessage(null);
    setStatusMessage(null);
    setLastInviteLink(null);
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(slug)}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            invite?: TeamSnapshot["invites"][number] & { inviteLink?: string };
            error?: string;
          }
        | null;
      if (!response.ok || !payload?.invite) {
        throw new Error(payload?.error ?? "Could not send invite.");
      }
      const invite = payload.invite;
      setInvites((previous) => [invite, ...previous.filter((item) => item.id !== invite.id)]);
      setLastInviteLink(invite.inviteLink ?? null);
      setInviteEmail("");
      setStatusMessage("Invite created.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not send invite.");
    } finally {
      setInviteState("idle");
    }
  }

  async function updateRole(targetUserId: string, role: TeamRole) {
    if (!managementEnabled || role === "owner") return;
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(slug)}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, role })
      });
      const payload = (await response.json().catch(() => null)) as
        | { member?: TeamSnapshot["members"][number]; error?: string }
        | null;
      if (!response.ok || !payload?.member) {
        throw new Error(payload?.error ?? "Could not update role.");
      }
      setMembers((previous) =>
        previous.map((member) => (member.userId === targetUserId ? payload.member! : member))
      );
      setStatusMessage(`Updated ${targetUserId} to ${role}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not update role.");
    }
  }

  async function removeMember(targetUserId: string) {
    if (!managementEnabled || removingUserId) return;
    setErrorMessage(null);
    setStatusMessage(null);
    setRemovingUserId(targetUserId);
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(slug)}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId })
      });
      const payload = (await response.json().catch(() => null)) as { removed?: boolean; error?: string } | null;
      if (!response.ok || !payload?.removed) {
        throw new Error(payload?.error ?? "Could not remove member.");
      }
      setMembers((previous) => previous.filter((member) => member.userId !== targetUserId));
      setStatusMessage(`Removed ${targetUserId} from the team.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not remove member.");
    } finally {
      setRemovingUserId(null);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-4 sm:p-5 shadow-xl shadow-slate-950/60">
        <h2 className="text-lg font-semibold text-slate-100">Team profile</h2>
        <p className="mt-1 text-sm text-slate-400">Role: {initialSnapshot.team.role}</p>
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void saveName();
          }}
        >
          <label htmlFor="team-name-input" className="sr-only">
            Team name
          </label>
          <input
            id="team-name-input"
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
            disabled={!managementEnabled}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!managementEnabled || nameSaveState === "saving"}
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {nameSaveState === "saving" ? "Saving..." : "Save"}
          </button>
        </form>
        {!managementEnabled && (
          <p className="mt-2 text-xs text-amber-300">Only owner/admin can update team profile settings.</p>
        )}
      </article>

      <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-4 sm:p-5 shadow-xl shadow-slate-950/60">
        <h2 className="text-lg font-semibold text-slate-100">Invite by email</h2>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void inviteMember();
          }}
        >
          <label htmlFor="team-invite-email" className="sr-only">
            Invite email
          </label>
          <input
            id="team-invite-email"
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="teammate@company.com"
            disabled={!managementEnabled}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!managementEnabled || inviteState === "saving"}
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {inviteState === "saving" ? "Inviting..." : "Send invite"}
          </button>
        </form>
        {lastInviteLink && (
          <p className="mt-2 text-xs text-slate-300">
            Invite link:{" "}
            <a href={lastInviteLink} className="break-all text-sky-300 transition hover:text-sky-200">
              {lastInviteLink}
            </a>
          </p>
        )}
      </article>

      {(statusMessage || errorMessage) && (
        <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-4 lg:col-span-2">
          {statusMessage && <p className="text-sm text-emerald-300">{statusMessage}</p>}
          {errorMessage && <p className="text-sm text-rose-300">{errorMessage}</p>}
        </article>
      )}

      <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-4 sm:p-5 shadow-xl shadow-slate-950/60">
        <h2 className="text-lg font-semibold text-slate-100">Team members</h2>
        {sortedMembers.length === 0 ? (
          <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-400">
            No members in this team yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {sortedMembers.map((member) => {
              const profile = initialSnapshot.memberProfiles[member.userId];
              return (
                <li key={member.userId} className="rounded-md border border-slate-800 bg-slate-950/60 p-2.5">
                  <div className="flex items-center gap-2">
                    {profile?.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt={`${profile.displayName} avatar`}
                        className="h-7 w-7 rounded-full border border-slate-700 object-cover"
                      />
                    ) : (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-200">
                        {profile?.avatarInitials ?? member.userId.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-100">{profile?.displayName ?? member.userId}</p>
                      <p className="truncate text-xs text-slate-500">{member.userId}</p>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Joined {new Date(member.joinedAt).toLocaleDateString()} • role: {member.role}
                  </p>
                  {managementEnabled && member.role !== "owner" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void updateRole(member.userId, "admin")}
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
                      >
                        Make admin
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateRole(member.userId, "member")}
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
                      >
                        Make member
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeMember(member.userId)}
                        disabled={removingUserId === member.userId}
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-rose-500/60 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {removingUserId === member.userId ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </article>

      <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-4 sm:p-5 shadow-xl shadow-slate-950/60">
        <h2 className="text-lg font-semibold text-slate-100">Pending invites</h2>
        {invites.length === 0 ? (
          <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-400">
            No invites yet. Send one above to add another teammate.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {invites.map((invite) => {
              const status = inviteStatus(invite);
              const inviteLink = `/teams/invite/${invite.token}`;
              return (
                <li key={invite.id} className="rounded-md border border-slate-800 bg-slate-950/60 p-2.5">
                  <p className="text-sm text-slate-100">{invite.email}</p>
                  <p className="text-xs text-slate-500">
                    {status} • expires {new Date(invite.expiresAt).toLocaleString()}
                  </p>
                  {status === "pending" && (
                    <p className="mt-1 break-all text-xs text-sky-300">{inviteLink}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </section>
  );
}
