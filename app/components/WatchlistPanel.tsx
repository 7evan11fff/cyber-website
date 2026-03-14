"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import {
  DOMAIN_HISTORY_STORAGE_KEY,
  MAX_WATCHLIST_ITEMS,
  type NotificationFrequency,
  type DomainGradeHistoryRecord,
  WATCHLIST_ALERT_EMAIL_STORAGE_KEY,
  WATCHLIST_NOTIFICATION_FREQUENCY_STORAGE_KEY,
  WATCHLIST_STORAGE_KEY,
  mergeDomainGradeHistories,
  normalizeDomainGradeHistory,
  recordDomainGradeHistoryPoint,
  isNotificationFrequency,
  isWatchlistEntry,
  mergeWatchlists,
  type WatchlistEntry
} from "@/lib/userData";
import { useToast } from "@/app/components/ToastProvider";

type LatestReportSummary = {
  checkedUrl: string;
  grade: string;
  checkedAt: string;
};

type CheckApiResponse = {
  checkedUrl: string;
  grade: string;
  checkedAt: string;
};

type RefreshState = "idle" | "running" | "error";

const WATCHLIST_AUTO_REFRESH_MS = 1000 * 60 * 30;

const GRADE_RANK: Record<string, number> = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  F: 1
};

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
  const [domainHistory, setDomainHistory] = useState<DomainGradeHistoryRecord>({});
  const [refreshState, setRefreshState] = useState<RefreshState>("idle");
  const [activeRefreshId, setActiveRefreshId] = useState<string | null>(null);
  const [alertEmailInput, setAlertEmailInput] = useState("");
  const [savedAlertEmail, setSavedAlertEmail] = useState<string | null>(null);
  const [notificationOnGradeChange, setNotificationOnGradeChange] = useState(true);
  const [notificationFrequency, setNotificationFrequency] = useState<NotificationFrequency>("instant");
  const [alertSaveState, setAlertSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [localWatchlistLoaded, setLocalWatchlistLoaded] = useState(false);
  const [localDomainHistoryLoaded, setLocalDomainHistoryLoaded] = useState(false);
  const [localEmailLoaded, setLocalEmailLoaded] = useState(false);
  const [localFrequencyLoaded, setLocalFrequencyLoaded] = useState(false);
  const [serverSyncReady, setServerSyncReady] = useState(false);
  const [syncedUserKey, setSyncedUserKey] = useState<string | null>(null);
  const [watchlistAnnouncement, setWatchlistAnnouncement] = useState("");
  const { data: session, status: sessionStatus } = useSession();
  const { notify } = useToast();
  const announceWatchlistUpdate = useCallback((message: string) => {
    setWatchlistAnnouncement("");
    window.setTimeout(() => setWatchlistAnnouncement(message), 10);
  }, []);


  const isAuthenticated = sessionStatus === "authenticated";
  const currentUserKey = session?.user?.email ?? session?.user?.name ?? null;

  const persistWatchlistLocal = useCallback((entries: WatchlistEntry[]) => {
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Ignore persistence failures in private mode.
    }
  }, []);

  const persistDomainHistoryLocal = useCallback((history: DomainGradeHistoryRecord) => {
    try {
      if (Object.keys(history).length === 0) {
        localStorage.removeItem(DOMAIN_HISTORY_STORAGE_KEY);
      } else {
        localStorage.setItem(DOMAIN_HISTORY_STORAGE_KEY, JSON.stringify(history));
      }
    } catch {
      // Ignore persistence failures in private mode.
    }
  }, []);

  const persistAlertEmailLocal = useCallback((email: string | null) => {
    try {
      if (email) {
        localStorage.setItem(WATCHLIST_ALERT_EMAIL_STORAGE_KEY, email);
      } else {
        localStorage.removeItem(WATCHLIST_ALERT_EMAIL_STORAGE_KEY);
      }
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const persistNotificationFrequencyLocal = useCallback((frequency: NotificationFrequency) => {
    try {
      localStorage.setItem(WATCHLIST_NOTIFICATION_FREQUENCY_STORAGE_KEY, frequency);
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const syncServerData = useCallback(
    async (patch: {
      watchlist?: WatchlistEntry[];
      history?: DomainGradeHistoryRecord;
      alertEmail?: string | null;
      notificationOnGradeChange?: boolean;
      notificationFrequency?: NotificationFrequency;
      watchlistNotificationLog?: Record<string, string>;
    }) => {
      if (!isAuthenticated) return;
      try {
        await fetch("/api/user-data", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch)
        });
      } catch {
        // Best-effort sync keeps local state available even offline.
      }
    },
    [isAuthenticated]
  );

  useEffect(() => {
    try {
      const rawWatchlist = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (!rawWatchlist) return;
      const parsed = JSON.parse(rawWatchlist);
      if (!Array.isArray(parsed)) return;
      setWatchlist(parsed.filter(isWatchlistEntry).slice(0, MAX_WATCHLIST_ITEMS));
    } catch {
      setWatchlist([]);
    } finally {
      setLocalWatchlistLoaded(true);
    }
  }, []);

  useEffect(() => {
    try {
      const rawHistory = localStorage.getItem(DOMAIN_HISTORY_STORAGE_KEY);
      if (!rawHistory) return;
      const parsed = JSON.parse(rawHistory);
      setDomainHistory(normalizeDomainGradeHistory(parsed));
    } catch {
      setDomainHistory({});
    } finally {
      setLocalDomainHistoryLoaded(true);
    }
  }, []);

  useEffect(() => {
    try {
      const persistedEmail = localStorage.getItem(WATCHLIST_ALERT_EMAIL_STORAGE_KEY);
      if (!persistedEmail) return;
      setAlertEmailInput(persistedEmail);
      setSavedAlertEmail(persistedEmail);
    } catch {
      setAlertEmailInput("");
      setSavedAlertEmail(null);
    } finally {
      setLocalEmailLoaded(true);
    }
  }, []);

  useEffect(() => {
    try {
      const rawFrequency = localStorage.getItem(WATCHLIST_NOTIFICATION_FREQUENCY_STORAGE_KEY);
      if (!rawFrequency || !isNotificationFrequency(rawFrequency)) return;
      setNotificationFrequency(rawFrequency);
    } finally {
      setLocalFrequencyLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) return;
    setServerSyncReady(false);
    setSyncedUserKey(null);
  }, [isAuthenticated]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !currentUserKey ||
      !localWatchlistLoaded ||
      !localDomainHistoryLoaded ||
      !localEmailLoaded ||
      !localFrequencyLoaded
    ) {
      return;
    }
    if (syncedUserKey === currentUserKey) return;

    let cancelled = false;
    const localWatchlist = watchlist;
    const localHistory = domainHistory;
    const localAlertEmail = savedAlertEmail;

    async function mergeLocalAndRemoteData() {
      try {
        const response = await fetch("/api/user-data", { method: "GET", cache: "no-store" });
        const payload = response.ok
          ? ((await response.json()) as {
              watchlist?: unknown;
              history?: unknown;
              alertEmail?: unknown;
              notificationOnGradeChange?: unknown;
              notificationFrequency?: unknown;
            })
          : null;

        const serverWatchlist =
          payload && Array.isArray(payload.watchlist)
            ? payload.watchlist.filter(isWatchlistEntry)
            : [];
        const mergedWatchlist = mergeWatchlists(localWatchlist, serverWatchlist);
        const serverHistory = normalizeDomainGradeHistory(payload?.history);
        const mergedHistory = mergeDomainGradeHistories(localHistory, serverHistory);
        const serverEmail = payload && typeof payload.alertEmail === "string" ? payload.alertEmail : null;
        const mergedAlertEmail = serverEmail ?? localAlertEmail;
        const serverNotificationEnabled =
          payload && typeof payload.notificationOnGradeChange === "boolean"
            ? payload.notificationOnGradeChange
            : null;
        const mergedNotificationEnabled = serverNotificationEnabled ?? true;
        const serverFrequency =
          payload && isNotificationFrequency(payload.notificationFrequency)
            ? payload.notificationFrequency
            : null;
        const mergedFrequency = serverFrequency ?? notificationFrequency;

        if (cancelled) return;
        setWatchlist(mergedWatchlist);
        persistWatchlistLocal(mergedWatchlist);
        setDomainHistory(mergedHistory);
        persistDomainHistoryLocal(mergedHistory);

        if (mergedAlertEmail) {
          setSavedAlertEmail(mergedAlertEmail);
          setAlertEmailInput(mergedAlertEmail);
          persistAlertEmailLocal(mergedAlertEmail);
        } else {
          setSavedAlertEmail(null);
          setAlertEmailInput("");
          persistAlertEmailLocal(null);
        }
        setNotificationOnGradeChange(mergedNotificationEnabled);
        setNotificationFrequency(mergedFrequency);
        persistNotificationFrequencyLocal(mergedFrequency);

        await syncServerData({
          watchlist: mergedWatchlist,
          history: mergedHistory,
          alertEmail: mergedAlertEmail ?? null,
          notificationOnGradeChange: mergedNotificationEnabled,
          notificationFrequency: mergedFrequency
        });
      } finally {
        if (!cancelled) {
          setServerSyncReady(true);
          setSyncedUserKey(currentUserKey);
        }
      }
    }

    void mergeLocalAndRemoteData();
    return () => {
      cancelled = true;
    };
  }, [
    currentUserKey,
    domainHistory,
    isAuthenticated,
    localDomainHistoryLoaded,
    localEmailLoaded,
    localFrequencyLoaded,
    localWatchlistLoaded,
    persistDomainHistoryLocal,
    persistAlertEmailLocal,
    persistNotificationFrequencyLocal,
    persistWatchlistLocal,
    notificationFrequency,
    savedAlertEmail,
    syncServerData,
    syncedUserKey,
    watchlist
  ]);

  const persistWatchlist = useCallback(
    (updater: (previous: WatchlistEntry[]) => WatchlistEntry[]) => {
      setWatchlist((previous) => {
        const next = updater(previous).slice(0, MAX_WATCHLIST_ITEMS);
        persistWatchlistLocal(next);
        if (isAuthenticated && serverSyncReady) {
          void syncServerData({ watchlist: next });
        }
        return next;
      });
    },
    [isAuthenticated, persistWatchlistLocal, serverSyncReady, syncServerData]
  );

  const persistDomainHistory = useCallback(
    (updater: (previous: DomainGradeHistoryRecord) => DomainGradeHistoryRecord) => {
      setDomainHistory((previous) => {
        const next = normalizeDomainGradeHistory(updater(previous));
        persistDomainHistoryLocal(next);
        if (isAuthenticated && serverSyncReady) {
          void syncServerData({ history: next });
        }
        return next;
      });
    },
    [isAuthenticated, persistDomainHistoryLocal, serverSyncReady, syncServerData]
  );

  const currentReportWatched = useMemo(() => {
    if (!latestReport) return false;
    return watchlist.some((entry) => entry.url === latestReport.checkedUrl);
  }, [latestReport, watchlist]);

  const scanAndUpdateEntry = useCallback(
    async (entryId: string, entryUrl: string, options?: { silent?: boolean }) => {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: entryUrl })
      });

      const payload = (await response.json().catch(() => null)) as
        | CheckApiResponse
        | { error?: unknown }
        | null;
      if (!response.ok || !isCheckApiResponse(payload)) {
        const apiError =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Could not refresh watchlist entry.";
        throw new Error(apiError);
      }

      const previousEntry = watchlist.find((entry) => entry.id === entryId);
      const gradeChanged = Boolean(previousEntry && previousEntry.lastGrade !== payload.grade);

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
      persistDomainHistory((previous) =>
        recordDomainGradeHistoryPoint(previous, {
          url: payload.checkedUrl,
          grade: payload.grade,
          checkedAt: payload.checkedAt
        })
      );

      if (gradeChanged && previousEntry) {
        announceWatchlistUpdate(
          `Watchlist update for ${payload.checkedUrl}. Grade changed from ${previousEntry.lastGrade} to ${payload.grade}.`
        );
      } else {
        announceWatchlistUpdate(`Watchlist update for ${payload.checkedUrl}. Grade is ${payload.grade}.`);
      }

      if (
        isAuthenticated &&
        savedAlertEmail &&
        notificationOnGradeChange &&
        previousEntry &&
        gradeChanged
      ) {
        const notifyResponse = await fetch("/api/watchlist-notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            url: payload.checkedUrl,
            previousGrade: previousEntry.lastGrade,
            currentGrade: payload.grade,
            checkedAt: payload.checkedAt
          })
        });

        if (notifyResponse.ok) {
          const notificationPayload = (await notifyResponse.json().catch(() => null)) as
            | { sent?: boolean; reason?: string; nextEligibleAt?: string | null }
            | null;
          if (notificationPayload?.sent && !options?.silent) {
            notify({
              tone: "success",
              message: `Email alert sent to ${savedAlertEmail}.`
            });
          } else if (
            notificationPayload?.reason === "frequency_throttled" &&
            !options?.silent &&
            notificationPayload.nextEligibleAt
          ) {
            notify({
              tone: "info",
              message: `Grade changed, but email is throttled until ${new Date(
                notificationPayload.nextEligibleAt
              ).toLocaleString()}.`
            });
          }
        } else if (!options?.silent) {
          notify({
            tone: "error",
            message: "Grade changed, but email notification could not be sent."
          });
        }
      }
    },
    [
      isAuthenticated,
      notificationOnGradeChange,
      notify,
      persistDomainHistory,
      persistWatchlist,
      savedAlertEmail,
      announceWatchlistUpdate,
      watchlist
    ]
  );

  const refreshEntry = useCallback(
    async (entryId: string, entryUrl: string) => {
      setActiveRefreshId(entryId);
      try {
        await scanAndUpdateEntry(entryId, entryUrl, { silent: false });
        notify({ tone: "success", message: "Watchlist entry refreshed." });
      } catch (error) {
        setRefreshState("error");
        notify({
          tone: "error",
          message: error instanceof Error ? error.message : "Could not refresh this watchlist entry."
        });
        window.setTimeout(() => setRefreshState("idle"), 2500);
      } finally {
        setActiveRefreshId((current) => (current === entryId ? null : current));
      }
    },
    [notify, scanAndUpdateEntry]
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
          await scanAndUpdateEntry(entry.id, entry.url, { silent: silent });
        } catch {
          hadError = true;
        }
      }

      if (!silent) {
        if (hadError) {
          setRefreshState("error");
          notify({ tone: "error", message: "Some watchlist checks failed. Please try again shortly." });
          window.setTimeout(() => setRefreshState("idle"), 2500);
        } else {
          setRefreshState("idle");
          notify({ tone: "success", message: "Watchlist refreshed." });
        }
      }
    },
    [notify, refreshState, scanAndUpdateEntry, watchlist]
  );

  useEffect(() => {
    if (watchlist.length === 0) return;
    const timer = window.setInterval(() => {
      void refreshAll(true);
    }, WATCHLIST_AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refreshAll, watchlist.length]);

  function addLatestReport() {
    if (!isAuthenticated) {
      const callbackUrl = typeof window === "undefined" ? "/" : window.location.pathname;
      void signIn(undefined, { callbackUrl });
      notify({ tone: "info", message: "Sign in to save scans to your watchlist." });
      return;
    }

    if (!latestReport) return;

    const wasWatched = watchlist.some((entry) => entry.url === latestReport.checkedUrl);
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
    persistDomainHistory((previous) =>
      recordDomainGradeHistoryPoint(previous, {
        url: latestReport.checkedUrl,
        grade: latestReport.grade,
        checkedAt: latestReport.checkedAt
      })
    );
    notify({
      tone: "success",
      message: wasWatched ? "Saved watchlist entry updated." : "Scan saved to watchlist."
    });
  }

  function removeEntry(entryId: string) {
    persistWatchlist((previous) => previous.filter((entry) => entry.id !== entryId));
    notify({ tone: "info", message: "Watchlist entry removed." });
  }

  function onEnableAlerts() {
    const normalized = alertEmailInput.trim();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
    if (!normalized || !validEmail) {
      setAlertSaveState("error");
      notify({ tone: "error", message: "Enter a valid email to enable alerts." });
      window.setTimeout(() => setAlertSaveState("idle"), 2500);
      return;
    }

    try {
      persistAlertEmailLocal(normalized);
      persistNotificationFrequencyLocal(notificationFrequency);
      setSavedAlertEmail(normalized);
      setAlertEmailInput(normalized);
      setNotificationOnGradeChange(true);
      setAlertSaveState("saved");
      if (isAuthenticated && serverSyncReady) {
        void syncServerData({
          alertEmail: normalized,
          notificationOnGradeChange: true,
          notificationFrequency
        });
      }
      notify({
        tone: "success",
        message: `Alert email saved ${isAuthenticated ? "to your account." : "locally on this device."}`
      });
    } catch {
      setAlertSaveState("error");
      notify({ tone: "error", message: "Could not save alert email right now." });
    } finally {
      window.setTimeout(() => setAlertSaveState("idle"), 2500);
    }
  }

  function onDisableAlerts() {
    persistAlertEmailLocal(null);
    setSavedAlertEmail(null);
    setAlertEmailInput("");
    setNotificationOnGradeChange(false);
    if (isAuthenticated && serverSyncReady) {
      void syncServerData({
        alertEmail: null,
        notificationOnGradeChange: false
      });
    }
    notify({ tone: "info", message: "Email alerts disabled for watchlist changes." });
  }

  return (
    <section className="motion-card mt-5 rounded-xl border border-slate-800/90 bg-slate-950/60">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {watchlistAnnouncement}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-200">Scheduled Watchlist Monitoring</p>
          <p className="text-xs text-slate-500">Auto-refreshes every 30 minutes while this tab is open.</p>
          {!isAuthenticated && (
            <p className="mt-1 text-xs text-amber-300">Sign in to save scans to your watchlist and dashboard.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addLatestReport}
            disabled={!latestReport || disabled}
            aria-label={
              !isAuthenticated
                ? "Sign in to save current scan"
                : currentReportWatched
                  ? "Update saved watchlist URL from current scan"
                  : "Save current scan to watchlist"
            }
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {!isAuthenticated
              ? "Sign in to save scan"
              : currentReportWatched
                ? "Update saved URL"
                : "Save current scan"}
          </button>
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={watchlist.length === 0 || disabled || refreshState === "running"}
            aria-label="Refresh all watchlist entries now"
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshState === "running" ? "Refreshing..." : "Refresh watchlist"}
          </button>
        </div>
      </div>
      <div className="border-t border-slate-800/90 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Email alerts</p>
        <form
          className="mt-2 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            onEnableAlerts();
          }}
        >
          <label htmlFor="watchlist-alert-email" className="sr-only">
            Alert email address
          </label>
          <input
            id="watchlist-alert-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={alertEmailInput}
            onChange={(event) => setAlertEmailInput(event.target.value)}
            placeholder="you@company.com"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          />
          <select
            value={notificationFrequency}
            onChange={(event) => setNotificationFrequency(event.target.value as NotificationFrequency)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          >
            <option value="instant">Instant</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <button
            type="submit"
            disabled={disabled}
            aria-label="Save watchlist email alert settings"
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save alerts
          </button>
          {savedAlertEmail && (
            <button
              type="button"
              onClick={onDisableAlerts}
              disabled={disabled}
              aria-label="Disable watchlist email alerts"
              className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 transition hover:border-rose-500/50 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Disable
            </button>
          )}
        </form>
        {savedAlertEmail && (
          <p className="mt-2 text-xs text-slate-400">
            Alerts {notificationOnGradeChange ? "enabled" : "paused"} for{" "}
            <span className="text-slate-200">{savedAlertEmail}</span> ({notificationFrequency}).
          </p>
        )}
        {alertSaveState === "saved" && (
          <p className="mt-1 text-xs text-emerald-300">
            Alert email saved {isAuthenticated ? "to your account." : "locally."}
          </p>
        )}
        {alertSaveState === "error" && (
          <p className="mt-1 text-xs text-rose-300">Enter a valid email to enable alerts.</p>
        )}
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
                <li key={entry.id} className="motion-card rounded-lg border border-slate-800/80 bg-slate-900/70 p-3">
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
                      aria-label={`Open report for ${entry.url}`}
                      className="rounded-md border border-slate-700 px-2 py-1.5 text-xs text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Open report
                    </button>
                    <button
                      type="button"
                      onClick={() => void refreshEntry(entry.id, entry.url)}
                      disabled={disabled || activeRefreshId === entry.id}
                      aria-label={`Refresh watchlist entry for ${entry.url}`}
                      className="rounded-md border border-slate-700 px-2 py-1.5 text-xs text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {activeRefreshId === entry.id ? "Refreshing..." : "Refresh"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      disabled={disabled}
                      aria-label={`Remove ${entry.url} from watchlist`}
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
