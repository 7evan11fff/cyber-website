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
};

function compareRoles(a: TeamRole, b: TeamRole) {
  const rank: Record<TeamRole, number> = { owner: 3, admin: 2, member: 1 };
  return rank[b] - rank[a];
}

export function TeamDashboardClient({
  slug,
  initialSnapshot
}: {
  slug: string;
  initialSnapshot: TeamSnapshot;
}) {
  const [members] = useState(initialSnapshot.members);
  const [watchlist, setWatchlist] = useState(initialSnapshot.watchlist);
  const [newUrl, setNewUrl] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [refreshingIds, setRefreshingIds] = useState<Record<string, boolean>>({});
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const rankDiff = compareRoles(a.role, b.role);
        if (rankDiff !== 0) return rankDiff;
        return a.userId.localeCompare(b.userId);
      }),
    [members]
  );

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
    setWatchlist((previous) => previous.filter((entry) => entry.id !== entryId));
  }

  return (
    <section className="grid gap-6 lg:grid-cols-3">
      <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-100">Shared watchlist</h2>
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={refreshingAll || watchlist.length === 0}
            className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshingAll ? "Refreshing..." : "Refresh all"}
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
            No team URLs saved yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {watchlist.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-100">{entry.url}</p>
                    <p className="text-xs text-slate-500">
                      Last checked {new Date(entry.lastCheckedAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-sky-200">Grade {entry.lastGrade}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void refreshEntry(entry.id)}
                    disabled={Boolean(refreshingIds[entry.id])}
                    className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {refreshingIds[entry.id] ? "Refreshing..." : "Refresh"}
                  </button>
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
                  >
                    Open URL
                  </a>
                  <button
                    type="button"
                    onClick={() => void removeEntry(entry.id)}
                    className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-rose-500/50 hover:text-rose-200"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
        <h2 className="text-lg font-semibold text-slate-100">Members</h2>
        <p className="mt-1 text-sm text-slate-400">{sortedMembers.length} active members</p>
        <ul className="mt-3 space-y-2">
          {sortedMembers.map((member) => (
            <li key={member.userId} className="rounded-md border border-slate-800 bg-slate-950/60 p-2.5">
              <p className="truncate text-sm text-slate-100">{member.userId}</p>
              <p className="text-xs text-slate-500">
                {member.role} • joined {new Date(member.joinedAt).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
