"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";
import { useToast } from "@/app/components/ToastProvider";

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
  viewerUserId: string;
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
};

function canManageTeam(role: TeamRole) {
  return role === "owner" || role === "admin";
}

function inviteStatus(invite: TeamSnapshot["invites"][number]): "pending" | "accepted" | "expired" {
  if (invite.acceptedAt) return "accepted";
  if (new Date(invite.expiresAt).getTime() <= Date.now()) return "expired";
  return "pending";
}

type ConfirmAction =
  | { kind: "remove-member"; userId: string }
  | { kind: "leave-team" }
  | { kind: "delete-team" }
  | null;

export function TeamSettingsClient({
  slug,
  initialSnapshot
}: {
  slug: string;
  initialSnapshot: TeamSnapshot;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [teamName, setTeamName] = useState(initialSnapshot.team.name);
  const [members, setMembers] = useState(initialSnapshot.members);
  const [invites, setInvites] = useState(initialSnapshot.invites);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteState, setInviteState] = useState<"idle" | "saving">("idle");
  const [resendingInviteIds, setResendingInviteIds] = useState<Record<string, boolean>>({});
  const [updatingMemberIds, setUpdatingMemberIds] = useState<Record<string, boolean>>({});
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [confirmState, setConfirmState] = useState<"idle" | "saving">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nameSaveState, setNameSaveState] = useState<"idle" | "saving">("idle");

  const sortedMembers = useMemo(() => {
    const rank: Record<TeamRole, number> = { owner: 3, admin: 2, member: 1 };
    return [...members].sort((a, b) => {
      const roleDiff = rank[b.role] - rank[a.role];
      if (roleDiff !== 0) return roleDiff;
      return a.userId.localeCompare(b.userId);
    });
  }, [members]);

  const managementEnabled = canManageTeam(initialSnapshot.team.role);
  const canDeleteTeam = initialSnapshot.team.role === "owner";
  const removeMemberTarget = confirmAction?.kind === "remove-member" ? confirmAction.userId : null;

  async function saveName() {
    if (!managementEnabled || nameSaveState === "saving") return;
    setErrorMessage(null);
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
      notify({ tone: "success", message: "Team name updated." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update team name.";
      setErrorMessage(message);
      notify({ tone: "error", message });
    } finally {
      setNameSaveState("idle");
    }
  }

  async function sendInvite(email: string, options?: { resend?: boolean; inviteId?: string }) {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !managementEnabled) return;
    const inviteId = options?.inviteId;
    const isResend = Boolean(options?.resend);
    if (isResend && inviteId) {
      setResendingInviteIds((previous) => ({ ...previous, [inviteId]: true }));
    } else if (inviteState === "saving") {
      return;
    } else {
      setInviteState("saving");
    }

    setErrorMessage(null);
    if (!isResend) {
      setLastInviteLink(null);
    }
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(slug)}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, resend: isResend })
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
      if (!isResend) {
        setInviteEmail("");
      }
      notify({
        tone: "success",
        message: isResend ? `Invite re-sent to ${invite.email}.` : `Invite sent to ${invite.email}.`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send invite.";
      setErrorMessage(message);
      notify({ tone: "error", message });
    } finally {
      if (isResend && inviteId) {
        setResendingInviteIds((previous) => {
          const next = { ...previous };
          delete next[inviteId];
          return next;
        });
      } else {
        setInviteState("idle");
      }
    }
  }

  async function inviteMember() {
    if (!managementEnabled || !inviteEmail.trim() || inviteState === "saving") return;
    await sendInvite(inviteEmail);
  }

  async function resendInvite(invite: TeamSnapshot["invites"][number]) {
    await sendInvite(invite.email, { resend: true, inviteId: invite.id });
  }

  async function removeMember(targetUserId: string) {
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(slug)}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            removed?: boolean;
            error?: string;
          }
        | null;
      if (!response.ok || !payload?.removed) {
        throw new Error(payload?.error ?? "Could not remove member.");
      }
      setMembers((previous) => previous.filter((member) => member.userId !== targetUserId));
      notify({ tone: "success", message: `${targetUserId} was removed from the team.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not remove member.";
      setErrorMessage(message);
      notify({ tone: "error", message });
      throw error;
    }
  }

  async function leaveTeam() {
    setErrorMessage(null);
    const response = await fetch(`/api/teams/${encodeURIComponent(slug)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "leave" })
    });
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!response.ok || !payload?.ok) {
      const message = payload?.error ?? "Could not leave team.";
      setErrorMessage(message);
      notify({ tone: "error", message });
      throw new Error(message);
    }
    notify({ tone: "success", message: "You left the team." });
    router.push("/teams");
    router.refresh();
  }

  async function deleteTeam() {
    setErrorMessage(null);
    const response = await fetch(`/api/teams/${encodeURIComponent(slug)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete" })
    });
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!response.ok || !payload?.ok) {
      const message = payload?.error ?? "Could not delete team.";
      setErrorMessage(message);
      notify({ tone: "error", message });
      throw new Error(message);
    }
    notify({ tone: "success", message: "Team deleted." });
    router.push("/teams");
    router.refresh();
  }

  async function confirmCurrentAction() {
    if (!confirmAction || confirmState === "saving") return;
    setConfirmState("saving");
    try {
      if (confirmAction.kind === "remove-member") {
        await removeMember(confirmAction.userId);
      } else if (confirmAction.kind === "leave-team") {
        await leaveTeam();
      } else if (confirmAction.kind === "delete-team") {
        await deleteTeam();
      }
      setConfirmAction(null);
    } finally {
      setConfirmState("idle");
    }
  }

  async function updateRole(targetUserId: string, role: TeamRole) {
    if (!managementEnabled || role === "owner") return;
    setUpdatingMemberIds((previous) => ({ ...previous, [targetUserId]: true }));
    setErrorMessage(null);
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
      notify({ tone: "success", message: `Updated ${targetUserId} to ${role}.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update role.";
      setErrorMessage(message);
      notify({ tone: "error", message });
    } finally {
      setUpdatingMemberIds((previous) => {
        const next = { ...previous };
        delete next[targetUserId];
        return next;
      });
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
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

      <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
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

      {errorMessage && (
        <article className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 lg:col-span-2">
          <p className="text-sm text-rose-200">{errorMessage}</p>
        </article>
      )}

      <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
        <h2 className="text-lg font-semibold text-slate-100">Team members</h2>
        <ul className="mt-3 space-y-2">
          {sortedMembers.map((member) => (
            <li key={member.userId} className="rounded-md border border-slate-800 bg-slate-950/60 p-2.5">
              <p className="truncate text-sm text-slate-100">{member.userId}</p>
              <p className="text-xs text-slate-500">
                Joined {new Date(member.joinedAt).toLocaleDateString()} • role: {member.role}
              </p>
              {managementEnabled && member.role !== "owner" && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void updateRole(member.userId, "admin")}
                    disabled={Boolean(updatingMemberIds[member.userId])}
                    aria-label={`Promote ${member.userId} to admin`}
                    className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
                  >
                    Make admin
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateRole(member.userId, "member")}
                    disabled={Boolean(updatingMemberIds[member.userId])}
                    aria-label={`Set ${member.userId} as member`}
                    className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
                  >
                    Make member
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(updatingMemberIds[member.userId])}
                    onClick={() => setConfirmAction({ kind: "remove-member", userId: member.userId })}
                    aria-label={`Remove ${member.userId} from team`}
                    className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-rose-500/50 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </article>

      <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
        <h2 className="text-lg font-semibold text-slate-100">Pending invites</h2>
        {invites.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No invites yet.</p>
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
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="break-all text-xs text-sky-300">{inviteLink}</p>
                      <button
                        type="button"
                        onClick={() => void resendInvite(invite)}
                        disabled={Boolean(resendingInviteIds[invite.id])}
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {resendingInviteIds[invite.id] ? "Sending..." : "Re-send"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </article>

      <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60 lg:col-span-2">
        <h2 className="text-lg font-semibold text-slate-100">Danger zone</h2>
        <p className="mt-2 text-sm text-slate-400">
          These actions are permanent. Review team impact before continuing.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {canDeleteTeam ? (
            <button
              type="button"
              onClick={() => setConfirmAction({ kind: "delete-team" })}
              className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/20"
            >
              Delete team
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmAction({ kind: "leave-team" })}
              className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/20"
            >
              Leave team
            </button>
          )}
        </div>
      </article>

      <ConfirmDialog
        open={confirmAction !== null}
        busy={confirmState === "saving"}
        onCancel={() => {
          if (confirmState !== "saving") {
            setConfirmAction(null);
          }
        }}
        onConfirm={confirmCurrentAction}
        tone={confirmAction?.kind === "remove-member" || confirmAction?.kind === "delete-team" ? "danger" : "default"}
        title={
          confirmAction?.kind === "remove-member"
            ? "Remove team member?"
            : confirmAction?.kind === "leave-team"
              ? "Leave this team?"
              : "Delete this team?"
        }
        description={
          confirmAction?.kind === "remove-member"
            ? `Remove ${removeMemberTarget} from this team. They will lose access immediately.`
            : confirmAction?.kind === "leave-team"
              ? "You will lose access to this shared watchlist and team settings."
              : "This permanently deletes the team, member links, invites, and shared watchlist entries."
        }
        confirmLabel={
          confirmAction?.kind === "remove-member"
            ? "Remove member"
            : confirmAction?.kind === "leave-team"
              ? "Leave team"
              : "Delete team"
        }
      />
    </section>
  );
}
