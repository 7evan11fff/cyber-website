"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type LatestReportSummary = {
  checkedUrl: string;
  grade: string;
  checkedAt: string;
};

type WatchlistEntry = {
  id: string;
  url: string;
  lastGrade: string;
  previousGrade: string | null;
  lastCheckedAt: string;
};

type CheckApiResponse = {
  checkedUrl: string;
  grade: string;
  checkedAt: string;
};

type RefreshState = "idle" | "running" | "error";

const WATCHLIST_STORAGE_KEY = "security-header-checker:watchlist";
const MAX_WATCHLIST_ITEMS = 20;
const WATCHLIST_AUTO_REFRESH_MS = 1000 * 60 * 30;

const GRADE_RANK: Record<string, number> = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  F: 1
};

function isWatchlistEntry(value: unknown): value is WatchlistEntry {
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

function isCheckApiResponse(value: unknown): value is CheckApiResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CheckApiResponse>;
  return (
    typeof candidate.checkedUrl === "string" &&
    typeof candidate.grade === "string" &&
    typeof candidate.checkedAt === "string"
  );
}

function describeGradeDiff(previousGrade: string, currentGrade: string) {
  const previousRank = GRADE_RANK[previousGrade] ?? 0;
  const currentRank = GRADE_RANK[currentGrade] ?? 0;
  if (currentRank > previousRank) {
    return {
      label: `Improved: ${previousGrade} -> ${currentGrade}`,
      className: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
    };
  }
  if (currentRank < previousRank) {
    return {
      label: `Regressed: ${previousGrade} -> ${currentGrade}`,
      className: "text-rose-300 border-rose-500/30 bg-rose-500/10"
    };
  }
  return {
    label: `No change: ${previousGrade} -> ${currentGrade}`,
    className: "text-slate-300 border-slate-700 bg-slate-900/70"
  };
}

export function WatchlistPanel({
  latestReport,
  onOpenReport,
  disabled
}: {
  latestReport: LatestReportSummary | null;
  onOpenReport: (url: string) => void;
  disabled?: boolean;
}) {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [refreshState, setRefreshState] = useState<RefreshState>("idle");
  const [activeRefreshId, setActiveRefreshId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const rawWatchlist = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (!rawWatchlist) return;
      const parsed = JSON.parse(rawWatchlist);
      if (!Array.isArray(parsed)) return;
      setWatchlist(parsed.filter(isWatchlistEntry).slice(0, MAX_WATCHLIST_ITEMS));
    } catch {
      setWatchlist([]);
    }
  }, []);

  const persistWatchlist = useCallback((updater: (previous: WatchlistEntry[]) => WatchlistEntry[]) => {
    setWatchlist((previous) => {
      const next = updater(previous).slice(0, MAX_WATCHLIST_ITEMS);
      try {
        localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore persistence failures in private mode.
      }
      return next;
    });
  }, []);

  const currentReportWatched = useMemo(() => {
    if (!latestReport) return false;
    return watchlist.some((entry) => entry.url === latestReport.checkedUrl);
  }, [latestReport, watchlist]);

  const scanAndUpdateEntry = useCallback(
    async (entryId: string, entryUrl: string) => {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: entryUrl })
      });

      const payload = await response.json();
      if (!response.ok || !isCheckApiResponse(payload)) {
        throw new Error("Could not refresh watchlist entry.");
      }

      persistWatchlist((previous) =>
        previous.map((entry) => {
          if (entry.id !== entryId) return entry;
          const changed = entry.lastGrade !== payload.grade;
          return {
            ...entry,
            url: payload.checkedUrl,
            lastGrade: payload.grade,
            previousGrade: changed ? entry.lastGrade : null,
            lastCheckedAt: payload.checkedAt
          };
        })
      );
    },
    [persistWatchlist]
  );

  const refreshEntry = useCallback(
    async (entryId: string, entryUrl: string) => {
      setActiveRefreshId(entryId);
      try {
        await scanAndUpdateEntry(entryId, entryUrl);
      } catch {
        setRefreshState("error");
        window.setTimeout(() => setRefreshState("idle"), 2500);
      } finally {
        setActiveRefreshId((current) => (current === entryId ? null : current));
      }
    },
    [scanAndUpdateEntry]
  );

  const refreshAll = useCallback(
    async (silent = false) => {
      if (watchlist.length === 0 || refreshState === "running") return;
      if (!silent) {
        setRefreshState("running");
      }

      let hadError = false;
      for (const entry of watchlist) {
        try {
          await scanAndUpdateEntry(entry.id, entry.url);
        } catch {
          hadError = true;
        }
      }

      if (!silent) {
        if (hadError) {
          setRefreshState("error");
          window.setTimeout(() => setRefreshState("idle"), 2500);
        } else {
          setRefreshState("idle");
        }
      }
    },
    [refreshState, scanAndUpdateEntry, watchlist]
  );

  useEffect(() => {
    if (watchlist.length === 0) return;
    const timer = window.setInterval(() => {
      void refreshAll(true);
    }, WATCHLIST_AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refreshAll, watchlist.length]);

  function addLatestReport() {
    if (!latestReport) return;

    persistWatchlist((previous) => {
      const existing = previous.find((entry) => entry.url === latestReport.checkedUrl);
      if (existing) {
        const changed = existing.lastGrade !== latestReport.grade;
        const updated: WatchlistEntry = {
          ...existing,
          lastGrade: latestReport.grade,
          previousGrade: changed ? existing.lastGrade : existing.previousGrade,
          lastCheckedAt: latestReport.checkedAt
        };
        return [updated, ...previous.filter((entry) => entry.id !== existing.id)];
      }

      const created: WatchlistEntry = {
        id: `${Date.now()}-${latestReport.checkedUrl}`,
        url: latestReport.checkedUrl,
        lastGrade: latestReport.grade,
        previousGrade: null,
        lastCheckedAt: latestReport.checkedAt
      };
      return [created, ...previous];
    });
  }

  function removeEntry(entryId: string) {
    persistWatchlist((previous) => previous.filter((entry) => entry.id !== entryId));
  }

  return (
    <section className="mt-5 rounded-xl border border-slate-800/90 bg-slate-950/60">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-200">Scheduled Watchlist Monitoring</p>
          <p className="text-xs text-slate-500">Auto-refreshes every 30 minutes while this tab is open.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addLatestReport}
            disabled={!latestReport || disabled}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {currentReportWatched ? "Update saved URL" : "Save current scan"}
          </button>
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={watchlist.length === 0 || disabled || refreshState === "running"}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshState === "running" ? "Refreshing..." : "Refresh watchlist"}
          </button>
        </div>
      </div>

      <div className="border-t border-slate-800/90 px-4 py-3">
        {watchlist.length === 0 ? (
          <p className="text-sm text-slate-400">
            No watched URLs yet. Run a scan, then save it here to monitor grade changes.
          </p>
        ) : (
          <ul className="space-y-2">
            {watchlist.map((entry) => {
              const diff = entry.previousGrade
                ? describeGradeDiff(entry.previousGrade, entry.lastGrade)
                : null;
              return (
                <li key={entry.id} className="rounded-lg border border-slate-800/80 bg-slate-900/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-100">{entry.url}</p>
                      <p className="text-xs text-slate-500">
                        Last checked: {new Date(entry.lastCheckedAt).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-xl font-semibold text-sky-200">Grade {entry.lastGrade}</p>
                  </div>
                  {diff && (
                    <p className={`mt-2 inline-flex rounded-md border px-2 py-1 text-xs ${diff.className}`}>
                      {diff.label}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenReport(entry.url)}
                      disabled={disabled}
                      className="rounded-md border border-slate-700 px-2 py-1.5 text-xs text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Open report
                    </button>
                    <button
                      type="button"
                      onClick={() => void refreshEntry(entry.id, entry.url)}
                      disabled={disabled || activeRefreshId === entry.id}
                      className="rounded-md border border-slate-700 px-2 py-1.5 text-xs text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {activeRefreshId === entry.id ? "Refreshing..." : "Refresh"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      disabled={disabled}
                      className="rounded-md border border-slate-700 px-2 py-1.5 text-xs text-slate-300 transition hover:border-rose-500/50 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {refreshState === "error" && (
          <p className="mt-2 text-xs text-rose-300">One or more watchlist checks failed. Try again shortly.</p>
        )}
      </div>
    </section>
  );
}
