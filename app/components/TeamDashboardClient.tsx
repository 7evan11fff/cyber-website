"use client";

import { useMemo, useState } from "react";
import { TeamActivityFeed } from "@/app/components/TeamActivityFeed";

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
  watchlist: Array<{
    id: string;
    teamId: string;
    url: string;
    lastGrade: string;
    previousGrade: string | null;
    lastCheckedAt: string;
    createdAt: string;
    createdByUserId: string;
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
  activity: Array<{
    id: string;
    type:
      | "watchlist_added"
      | "watchlist_removed"
      | "scan_completed"
      | "member_joined"
      | "member_left"
      | "role_changed";
    actorUserId: string;
    createdAt: string;
    subjectUserId: string | null;
    subjectUrl: string | null;
    beforeValue: string | null;
    afterValue: string | null;
    message: string;
  }>;
};

function compareRoles(a: TeamRole, b: TeamRole) {
  const rank: Record<TeamRole, number> = { owner: 3, admin: 2, member: 1 };
  return rank[b] - rank[a];
}

function gradeScore(grade: string): number {
  const map: Record<string, number> = {
    A: 6,
    B: 5,
    C: 4,
    D: 3,
    E: 2,
    F: 1
  };
  return map[grade.toUpperCase()] ?? 0;
}

function gradeTrend(entry: TeamSnapshot["watchlist"][number]) {
  if (!entry.previousGrade) {
    return { label: "New", tone: "text-slate-300 border-slate-700" };
  }
  const current = gradeScore(entry.lastGrade);
  const previous = gradeScore(entry.previousGrade);
  if (current > previous) {
    return { label: "Up", tone: "text-emerald-300 border-emerald-500/40" };
  }
  if (current < previous) {
    return { label: "Down", tone: "text-rose-300 border-rose-500/40" };
  }
  return { label: "Stable", tone: "text-slate-300 border-slate-700" };
}

export function TeamDashboardClient({
  slug,
  initialSnapshot,
  viewerUserId
}: {
  slug: string;
  initialSnapshot: TeamSnapshot;
  viewerUserId: string;
}) {
  const [members] = useState(initialSnapshot.members);
  const [watchlist, setWatchlist] = useState(initialSnapshot.watchlist);
  const [activity, setActivity] = useState(initialSnapshot.activity);
  const [newUrl, setNewUrl] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [refreshingIds, setRefreshingIds] = useState<Record<string, boolean>>({});
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const memberProfiles = initialSnapshot.memberProfiles;

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const rankDiff = compareRoles(a.role, b.role);
        if (rankDiff !== 0) return rankDiff;
        return a.userId.localeCompare(b.userId);
      }),
    [members]
  );

  function updateActivityFeed(nextEntry: TeamSnapshot["watchlist"][number], kind: "added" | "removed" | "scanned") {
    const actorUserId = viewerUserId;
    const eventType =
      kind === "added" ? "watchlist_added" : kind === "removed" ? "watchlist_removed" : "scan_completed";
    const message =
      kind === "added"
        ? "added a URL to the shared watchlist."
        : kind === "removed"
          ? "removed a URL from the shared watchlist."
          : nextEntry.previousGrade && nextEntry.previousGrade !== nextEntry.lastGrade
            ? `scanned a URL and changed grade ${nextEntry.previousGrade} -> ${nextEntry.lastGrade}.`
            : "scanned a URL and the grade stayed the same.";

    setActivity((previous) =>
      [
        {
          id: `${Date.now()}-${nextEntry.id}-${kind}`,
          type: eventType,
          actorUserId,
          createdAt: new Date().toISOString(),
          subjectUserId: null,
          subjectUrl: nextEntry.url,
          beforeValue: kind === "removed" ? nextEntry.lastGrade : nextEntry.previousGrade,
          afterValue: kind === "removed" ? null : nextEntry.lastGrade,
          message
        },
        ...previous
      ].slice(0, 20)
    );
  }

  async function addWatchlistEntry() {
    if (!newUrl.trim() || saveState === "saving") return;
    setSaveState("saving");
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(slug)}/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl.trim() })
      });
      const payload = (await response.json().catch(() => null)) as
        | { entry?: TeamSnapshot["watchlist"][number]; error?: string }
        | null;
      if (!response.ok || !payload?.entry) {
        throw new Error(payload?.error ?? "Could not add URL to team watchlist.");
      }
      setWatchlist((previous) => {
        const withoutSameId = previous.filter((entry) => entry.id !== payload.entry?.id);
        return [payload.entry as TeamSnapshot["watchlist"][number], ...withoutSameId].sort(
          (a, b) => new Date(b.lastCheckedAt).getTime() - new Date(a.lastCheckedAt).getTime()
        );
      });
      updateActivityFeed(payload.entry as TeamSnapshot["watchlist"][number], "added");
      setNewUrl("");
      setSaveState("idle");
    } catch (error) {
      setSaveState("error");
      setErrorMessage(error instanceof Error ? error.message : "Could not add URL.");
      window.setTimeout(() => setSaveState("idle"), 2500);
    }
  }

  async function refreshEntry(entryId: string) {
    setRefreshingIds((previous) => ({ ...previous, [entryId]: true }));
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(slug)}/watchlist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            updated?: TeamSnapshot["watchlist"];
            errors?: string[];
            error?: string;
          }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Could not refresh entry.");
      }
      if (payload?.updated && payload.updated.length > 0) {
        const updated = payload.updated[0];
        setWatchlist((previous) =>
          previous
            .map((entry) => (entry.id === updated.id ? updated : entry))
            .sort((a, b) => new Date(b.lastCheckedAt).getTime() - new Date(a.lastCheckedAt).getTime())
        );
        updateActivityFeed(updated, "scanned");
      }
      if (payload?.errors?.length) {
        setErrorMessage(payload.errors[0]);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not refresh entry.");
    } finally {
      setRefreshingIds((previous) => {
        const next = { ...previous };
        delete next[entryId];
        return next;
      });
    }
  }

  async function refreshAll() {
    if (watchlist.length === 0 || refreshingAll) return;
    setRefreshingAll(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(slug)}/watchlist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            updated?: TeamSnapshot["watchlist"];
            errors?: string[];
            error?: string;
          }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Could not refresh team watchlist.");
      }
      if (payload?.updated && payload.updated.length > 0) {
        const updatedById = new Map(payload.updated.map((entry) => [entry.id, entry]));
        setWatchlist((previous) =>
          previous
            .map((entry) => updatedById.get(entry.id) ?? entry)
            .sort((a, b) => new Date(b.lastCheckedAt).getTime() - new Date(a.lastCheckedAt).getTime())
        );
        payload.updated.forEach((entry) => {
          updateActivityFeed(entry, "scanned");
        });
      }
      if (payload?.errors?.length) {
        setErrorMessage(payload.errors[0]);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not refresh team watchlist.");
    } finally {
      setRefreshingAll(false);
    }
  }

  async function removeEntry(entryId: string) {
    setErrorMessage(null);
    const response = await fetch(`/api/teams/${encodeURIComponent(slug)}/watchlist`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId })
    });
    const payload = (await response.json().catch(() => null)) as { removed?: boolean; error?: string } | null;
    if (!response.ok || !payload?.removed) {
      setErrorMessage(payload?.error ?? "Could not remove watchlist entry.");
      return;
    }
    const removedEntry = watchlist.find((entry) => entry.id === entryId) ?? null;
    setWatchlist((previous) => previous.filter((entry) => entry.id !== entryId));
    if (removedEntry) {
      updateActivityFeed(removedEntry, "removed");
    }
  }

  return (
    <section className="grid gap-6">
      <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-4 sm:p-5 shadow-xl shadow-slate-950/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-100">Shared watchlist</h2>
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={refreshingAll || watchlist.length === 0}
            className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshingAll ? "Scanning..." : "Scan All"}
          </button>
        </div>

        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void addWatchlistEntry();
          }}
        >
          <label htmlFor="team-watchlist-url" className="sr-only">
            URL to monitor
          </label>
          <input
            id="team-watchlist-url"
            value={newUrl}
            onChange={(event) => setNewUrl(event.target.value)}
            placeholder="https://example.com"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          />
          <button
            type="submit"
            disabled={saveState === "saving"}
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveState === "saving" ? "Adding..." : "Add URL"}
          </button>
        </form>

        {errorMessage && (
          <p className="mt-2 text-xs text-rose-300" role="status" aria-live="polite">
            {errorMessage}
          </p>
        )}

        {watchlist.length === 0 ? (
          <p className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
            No shared URLs yet. Add your first production domain to let everyone track grade changes in one place.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto" data-testid="team-watchlist-table-wrapper">
            <table className="min-w-[720px] w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.08em] text-slate-400">
                  <th className="px-2 py-1 font-medium">URL</th>
                  <th className="px-2 py-1 font-medium">Grade</th>
                  <th className="px-2 py-1 font-medium">Trend</th>
                  <th className="px-2 py-1 font-medium">Last checked</th>
                  <th className="px-2 py-1 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((entry) => {
                  const trend = gradeTrend(entry);
                  return (
                    <tr key={entry.id} className="rounded-lg border border-slate-800 bg-slate-950/60">
                      <td className="max-w-[280px] truncate rounded-l-lg border-y border-l border-slate-800 px-2 py-2 text-sm text-slate-100">
                        {entry.url}
                      </td>
                      <td className="border-y border-slate-800 px-2 py-2 text-sm font-semibold text-sky-200">
                        {entry.lastGrade}
                      </td>
                      <td className="border-y border-slate-800 px-2 py-2">
                        <span className={`inline-flex rounded border px-2 py-0.5 text-xs ${trend.tone}`}>
                          {trend.label}
                        </span>
                      </td>
                      <td className="border-y border-slate-800 px-2 py-2 text-xs text-slate-500">
                        {new Date(entry.lastCheckedAt).toLocaleString()}
                      </td>
                      <td className="rounded-r-lg border-y border-r border-slate-800 px-2 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void refreshEntry(entry.id)}
                            disabled={Boolean(refreshingIds[entry.id])}
                            className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {refreshingIds[entry.id] ? "Scanning..." : "Scan"}
                          </button>
                          <a
                            href={entry.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
                          >
                            Open
                          </a>
                          <button
                            type="button"
                            onClick={() => void removeEntry(entry.id)}
                            className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-rose-500/50 hover:text-rose-200"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TeamActivityFeed events={activity} memberProfiles={memberProfiles} />
        </div>
        <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-4 sm:p-5 shadow-xl shadow-slate-950/60">
          <h2 className="text-lg font-semibold text-slate-100">Members</h2>
          <p className="mt-1 text-sm text-slate-400">{sortedMembers.length} active members</p>
          {sortedMembers.length === 0 ? (
            <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-400">
              No members yet. Invite teammates in Team settings to collaborate on scans and watchlists.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {sortedMembers.map((member) => {
                const profile = memberProfiles[member.userId];
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
                      {member.role} • joined {new Date(member.joinedAt).toLocaleDateString()}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      </section>
    </section>
  );
}
