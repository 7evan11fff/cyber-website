"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";
import { MiniScoreTrendChart } from "@/app/components/MiniScoreTrendChart";
import { useToast } from "@/app/components/ToastProvider";
import { gradeToScore } from "@/lib/gradeTrends";

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
  watchlist: Array<{
    id: string;
    teamId: string;
    url: string;
    lastGrade: string;
    previousGrade: string | null;
    lastCheckedAt: string;
    createdAt: string;
    createdByUserId: string;
    lastScannedByUserId: string;
  }>;
  scanActivity: Array<{
    id: string;
    teamId: string;
    entryId: string | null;
    url: string;
    grade: string;
    scannedAt: string;
    scannedByUserId: string;
  }>;
  watchlistActivity: Array<{
    id: string;
    teamId: string;
    entryId: string | null;
    url: string;
    action: "added" | "removed";
    occurredAt: string;
    actorUserId: string;
  }>;
};

const SCORE_TO_GRADE: Record<number, string> = {
  5: "A",
  4: "B",
  3: "C",
  2: "D",
  1: "F"
};

function averageGradeFromScores(scores: number[]): string {
  if (scores.length === 0) return "--";
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const rounded = Math.max(1, Math.min(5, Math.round(average)));
  return SCORE_TO_GRADE[rounded];
}

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { notify } = useToast();
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const [members] = useState(initialSnapshot.members);
  const [watchlist, setWatchlist] = useState(initialSnapshot.watchlist);
  const [scanActivity, setScanActivity] = useState(initialSnapshot.scanActivity);
  const [watchlistActivity, setWatchlistActivity] = useState(initialSnapshot.watchlistActivity);
  const [newUrl, setNewUrl] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [refreshingIds, setRefreshingIds] = useState<Record<string, boolean>>({});
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [pendingRemovalEntryId, setPendingRemovalEntryId] = useState<string | null>(null);
  const [removeState, setRemoveState] = useState<"idle" | "saving">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("welcome") === "1") {
      setWelcomeOpen(true);
    }
  }, [searchParams]);

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const rankDiff = compareRoles(a.role, b.role);
        if (rankDiff !== 0) return rankDiff;
        return a.userId.localeCompare(b.userId);
      }),
    [members]
  );
  const memberNameById = useMemo(
    () => new Map(sortedMembers.map((member) => [member.userId, member.userId])),
    [sortedMembers]
  );
  const recentWatchlistActivity = useMemo(
    () =>
      [...watchlistActivity]
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, 10),
    [watchlistActivity]
  );
  const averageGrade = useMemo(() => {
    const scores = watchlist.map((entry) => gradeToScore(entry.lastGrade)).filter((score) => score > 0);
    return averageGradeFromScores(scores);
  }, [watchlist]);
  const alertsThisWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return scanActivity.filter((activity) => {
      const scannedAt = new Date(activity.scannedAt).getTime();
      if (!Number.isFinite(scannedAt) || scannedAt < cutoff) return false;
      return gradeToScore(activity.grade) <= 2;
    }).length;
  }, [scanActivity]);
  const trendPoints = useMemo(() => {
    const dayLabels: string[] = [];
    const dayKeys: string[] = [];
    const now = new Date();
    for (let dayOffset = 6; dayOffset >= 0; dayOffset -= 1) {
      const dayDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      const key = `${dayDate.getUTCFullYear()}-${String(dayDate.getUTCMonth() + 1).padStart(2, "0")}-${String(dayDate.getUTCDate()).padStart(2, "0")}`;
      dayKeys.push(key);
      dayLabels.push(dayDate.toLocaleDateString(undefined, { weekday: "short" }));
    }
    const dayKeySet = new Set(dayKeys);
    const scoresByDay = new Map<string, number[]>();
    for (const activity of scanActivity) {
      const scannedAt = new Date(activity.scannedAt);
      if (!Number.isFinite(scannedAt.getTime())) continue;
      const key = `${scannedAt.getUTCFullYear()}-${String(scannedAt.getUTCMonth() + 1).padStart(2, "0")}-${String(scannedAt.getUTCDate()).padStart(2, "0")}`;
      if (!dayKeySet.has(key)) continue;
      const score = gradeToScore(activity.grade);
      if (score <= 0) continue;
      const existing = scoresByDay.get(key);
      if (existing) {
        existing.push(score);
      } else {
        scoresByDay.set(key, [score]);
      }
    }
    return dayKeys.map((dayKey, index) => {
      const scores = scoresByDay.get(dayKey);
      const value = scores && scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
      return { label: dayLabels[index], value };
    });
  }, [scanActivity]);

  function focusQuickAddInput(prefill?: string) {
    if (typeof prefill === "string") {
      setNewUrl(prefill);
    }
    urlInputRef.current?.focus();
  }

  function closeWelcomeModal() {
    setWelcomeOpen(false);
    if (searchParams.get("welcome") === "1") {
      router.replace(`/teams/${encodeURIComponent(slug)}`, { scroll: false });
    }
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
        | {
            entry?: TeamSnapshot["watchlist"][number];
            activity?: TeamSnapshot["scanActivity"][number];
            error?: string;
          }
        | null;
      if (!response.ok || !payload?.entry) {
        throw new Error(payload?.error ?? "Could not add URL to team watchlist.");
      }
      const wasExisting = watchlist.some((entry) => entry.id === payload.entry!.id);
      setWatchlist((previous) => {
        const withoutSameId = previous.filter((entry) => entry.id !== payload.entry?.id);
        return [payload.entry as TeamSnapshot["watchlist"][number], ...withoutSameId].sort(
          (a, b) => new Date(b.lastCheckedAt).getTime() - new Date(a.lastCheckedAt).getTime()
        );
      });
      if (payload.activity) {
        setScanActivity((previous) => [payload.activity!, ...previous]);
      }
      if (!wasExisting) {
        setWatchlistActivity((previous) => {
          const createdEvent: TeamSnapshot["watchlistActivity"][number] = {
            id: `local-added-${payload.entry!.id}-${Date.now()}`,
            teamId: payload.entry!.teamId,
            entryId: payload.entry!.id,
            url: payload.entry!.url,
            action: "added",
            occurredAt: payload.entry!.createdAt,
            actorUserId: initialSnapshot.viewerUserId
          };
          return [createdEvent, ...previous].slice(0, 240);
        });
      }
      notify({ tone: "success", message: "Domain added to team watchlist." });
      setNewUrl("");
      setSaveState("idle");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not add URL.";
      setSaveState("error");
      setErrorMessage(message);
      notify({ tone: "error", message });
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
            activities?: TeamSnapshot["scanActivity"];
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
      if (payload?.activities?.length) {
        setScanActivity((previous) => [...payload.activities!, ...previous].slice(0, 200));
      }
      if (payload?.errors?.length) {
        setErrorMessage(payload.errors[0]);
        notify({ tone: "error", message: payload.errors[0] });
      } else {
        notify({ tone: "info", message: "Watchlist entry refreshed." });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not refresh entry.";
      setErrorMessage(message);
      notify({ tone: "error", message });
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
            activities?: TeamSnapshot["scanActivity"];
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
      if (payload?.activities?.length) {
        setScanActivity((previous) => [...payload.activities!, ...previous].slice(0, 400));
      }
      if (payload?.errors?.length) {
        setErrorMessage(payload.errors[0]);
        notify({ tone: "error", message: payload.errors[0] });
      } else {
        notify({ tone: "info", message: "Team watchlist refreshed." });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not refresh team watchlist.";
      setErrorMessage(message);
      notify({ tone: "error", message });
    } finally {
      setRefreshingAll(false);
    }
  }

  async function removeEntry(entryId: string) {
    if (removeState === "saving") return;
    setRemoveState("saving");
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(slug)}/watchlist`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            removed?: boolean;
            activity?: TeamSnapshot["watchlistActivity"][number] | null;
            error?: string;
          }
        | null;
      if (!response.ok || !payload?.removed) {
        throw new Error(payload?.error ?? "Could not remove watchlist entry.");
      }
      setWatchlist((previous) => previous.filter((entry) => entry.id !== entryId));
      if (payload.activity) {
        setWatchlistActivity((previous) => [payload.activity!, ...previous].slice(0, 240));
      }
      notify({ tone: "success", message: "Watchlist item removed." });
      setPendingRemovalEntryId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not remove watchlist entry.";
      setErrorMessage(message);
      notify({ tone: "error", message });
    } finally {
      setRemoveState("idle");
    }
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
            className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshingAll ? "Refreshing..." : "Refresh all"}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Quick-add a domain and monitor grade changes with your team in one place.
        </p>

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
            ref={urlInputRef}
            id="team-watchlist-url"
            value={newUrl}
            onChange={(event) => setNewUrl(event.target.value)}
            placeholder="https://example.com"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          />
          <button
            type="submit"
            disabled={saveState === "saving"}
            className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <svg
                viewBox="0 0 120 90"
                aria-hidden="true"
                className="empty-state-float h-20 w-24 text-sky-300/70"
                fill="none"
              >
                <rect x="8" y="10" width="104" height="70" rx="12" stroke="currentColor" strokeOpacity="0.45" />
                <path d="M18 57h84" stroke="currentColor" strokeOpacity="0.28" />
                <circle cx="30" cy="34" r="6" fill="currentColor" fillOpacity="0.42" />
                <circle cx="50" cy="34" r="6" fill="currentColor" fillOpacity="0.28" />
                <circle cx="70" cy="34" r="6" fill="currentColor" fillOpacity="0.2" />
                <circle cx="90" cy="34" r="6" fill="currentColor" fillOpacity="0.12" />
              </svg>
              <div>
                <p className="text-sm text-slate-300">No team URLs saved yet.</p>
                <p className="mt-1 text-xs text-slate-400">
                  Start with a demo domain to preview the team watchlist workflow.
                </p>
                <button
                  type="button"
                  onClick={() => focusQuickAddInput("https://example.com")}
                  className="mt-3 rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
                >
                  Add demo domain
                </button>
              </div>
            </div>
          </div>
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
                    <p className="text-xs text-slate-500">
                      Last scanned by {memberNameById.get(entry.lastScannedByUserId) ?? entry.lastScannedByUserId}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-sky-200">Grade {entry.lastGrade}</p>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => void refreshEntry(entry.id)}
                    disabled={Boolean(refreshingIds[entry.id])}
                    className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {refreshingIds[entry.id] ? "Refreshing..." : "Refresh"}
                  </button>
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
                  >
                    Open URL
                  </a>
                  <button
                    type="button"
                    onClick={() => setPendingRemovalEntryId(entry.id)}
                    className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-rose-500/50 hover:text-rose-200"
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

      <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
        <h2 className="text-lg font-semibold text-slate-100">Summary stats</h2>
        <p className="mt-1 text-sm text-slate-400">Team watchlist health and weekly alerts at a glance.</p>
        <dl className="mt-4 grid grid-cols-1 gap-2">
          <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <dt className="text-xs uppercase tracking-[0.12em] text-slate-400">Domains watched</dt>
            <dd className="mt-1 text-2xl font-semibold text-slate-100">{watchlist.length}</dd>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <dt className="text-xs uppercase tracking-[0.12em] text-slate-400">Average grade</dt>
            <dd className="mt-1 text-2xl font-semibold text-sky-200">{averageGrade}</dd>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <dt className="text-xs uppercase tracking-[0.12em] text-slate-400">Alerts this week</dt>
            <dd className="mt-1 text-2xl font-semibold text-amber-200">{alertsThisWeek}</dd>
          </div>
        </dl>
      </article>

      <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Team grade trend</h2>
            <p className="mt-1 text-xs text-slate-400">Average grade score across team scans in the last 7 days.</p>
          </div>
          <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
            {scanActivity.length} scans recorded
          </span>
        </div>
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-slate-200">
          <MiniScoreTrendChart
            points={trendPoints}
            className="h-24 w-full"
            ariaLabel="Team watchlist grade trend over the last 7 days"
          />
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] text-slate-400">
            {trendPoints.map((point) => (
              <span key={point.label}>{point.label}</span>
            ))}
          </div>
        </div>
      </article>

      <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60 lg:col-span-3">
        <h2 className="text-lg font-semibold text-slate-100">Recent watchlist activity</h2>
        {recentWatchlistActivity.length === 0 ? (
          <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
            Team add/remove events will appear here as teammates update the shared watchlist.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {recentWatchlistActivity.map((activity) => (
              <li key={activity.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-100">{activity.url}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {memberNameById.get(activity.actorUserId) ?? activity.actorUserId} {activity.action} this domain at{" "}
                      {new Date(activity.occurredAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      activity.action === "added"
                        ? "border border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                        : "border border-rose-500/35 bg-rose-500/10 text-rose-200"
                    }`}
                  >
                    {activity.action === "added" ? "Added" : "Removed"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>

      {welcomeOpen && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/75 px-4 py-8 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeWelcomeModal();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-welcome-title"
            className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl shadow-slate-950/70"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Welcome to your team</p>
            <h2 id="team-welcome-title" className="mt-2 text-xl font-semibold text-slate-100">
              Quick start in under a minute
            </h2>
            <ol className="mt-4 space-y-3 text-sm text-slate-300">
              <li className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
                <p className="font-medium text-slate-100">1. Add your first domain</p>
                <p className="mt-1 text-xs text-slate-400">Use quick-add to start tracking your team’s highest-risk pages.</p>
              </li>
              <li className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
                <p className="font-medium text-slate-100">2. Invite teammates</p>
                <p className="mt-1 text-xs text-slate-400">Share ownership so admins and members can keep domains current.</p>
              </li>
              <li className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
                <p className="font-medium text-slate-100">3. Check trend + activity</p>
                <p className="mt-1 text-xs text-slate-400">Monitor grade movement and recent domain changes in one dashboard.</p>
              </li>
            </ol>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  focusQuickAddInput("https://example.com");
                  closeWelcomeModal();
                }}
                className="rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-sky-200 transition hover:border-sky-400 hover:bg-sky-500/20"
              >
                Add first domain
              </button>
              <Link
                href={`/teams/${slug}/settings`}
                onClick={() => setWelcomeOpen(false)}
                className="justify-center rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
              >
                Invite teammates
              </Link>
              <button
                type="button"
                onClick={closeWelcomeModal}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
              >
                Skip for now
              </button>
            </div>
          </section>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingRemovalEntryId)}
        busy={removeState === "saving"}
        onCancel={() => {
          if (removeState !== "saving") {
            setPendingRemovalEntryId(null);
          }
        }}
        onConfirm={() => (pendingRemovalEntryId ? removeEntry(pendingRemovalEntryId) : undefined)}
        title="Remove watchlist item?"
        description="This will remove the URL from the shared team watchlist."
        confirmLabel="Remove"
        tone="danger"
      />
    </section>
  );
}
