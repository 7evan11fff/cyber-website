"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { useToast } from "@/app/components/ToastProvider";
import type { HeaderResult } from "@/lib/securityHeaders";
import {
  BROWSER_NOTIFICATIONS_ENABLED_STORAGE_KEY,
  COMPARISON_HISTORY_STORAGE_KEY,
  DOMAIN_HISTORY_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
  isComparisonHistoryEntry,
  isScanHistoryEntry,
  mergeComparisonHistories,
  mergeDomainGradeHistories,
  mergeScanHistories,
  normalizeComparisonHistoryEntries,
  normalizeDomainGradeHistory,
  normalizeScanHistoryEntries,
  recordDomainGradeHistoryPoint,
  type ComparisonHistoryEntry,
  type ScanHistoryEntry
} from "@/lib/userData";
import { sendBrowserNotification } from "@/lib/browserNotifications";

type ReportResponse = {
  checkedUrl: string;
  finalUrl: string;
  statusCode: number;
  score: number;
  grade: string;
  results: HeaderResult[];
  checkedAt: string;
};

type ComparisonReport = {
  siteA: ReportResponse;
  siteB: ReportResponse;
};

type ComparisonRowTone = "good" | "missing" | "weak" | "neutral";

const statusClassNames: Record<HeaderResult["status"], string> = {
  good: "bg-emerald-500/20 text-emerald-200 ring-emerald-500/40",
  weak: "bg-amber-500/20 text-amber-200 ring-amber-500/40",
  missing: "bg-rose-500/20 text-rose-200 ring-rose-500/40"
};

const gradeClassNames: Record<string, string> = {
  A: "text-emerald-300",
  B: "text-lime-300",
  C: "text-amber-300",
  D: "text-orange-300",
  F: "text-rose-300"
};

function gradeColor(grade: string) {
  return gradeClassNames[grade] ?? "text-slate-200";
}

function normalizeUrl(value: string) {
  return value.trim();
}

function extractHost(value: string) {
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProtocol).hostname || value;
  } catch {
    return value;
  }
}

function comparisonTone(a: HeaderResult, b: HeaderResult): ComparisonRowTone {
  if (a.status === "good" && b.status === "good") return "good";
  if (a.status === "missing" || b.status === "missing") return "missing";
  if (a.status === "weak" || b.status === "weak") return "weak";
  return "neutral";
}

function rowClasses(tone: ComparisonRowTone) {
  if (tone === "good") {
    return "border-emerald-500/30 bg-emerald-500/10";
  }
  if (tone === "missing") {
    return "border-rose-500/40 bg-rose-500/10";
  }
  if (tone === "weak") {
    return "border-amber-500/40 bg-amber-500/10";
  }
  return "border-slate-800/70 bg-slate-900/40";
}

function getGradeNarrative(comparison: ComparisonReport) {
  const scoreDifference = comparison.siteA.score - comparison.siteB.score;
  if (scoreDifference > 0) {
    return `Site A is stronger by ${scoreDifference} point${scoreDifference === 1 ? "" : "s"}.`;
  }
  if (scoreDifference < 0) {
    const magnitude = Math.abs(scoreDifference);
    return `Site B is stronger by ${magnitude} point${magnitude === 1 ? "" : "s"}.`;
  }
  return "Both sites have the same overall score.";
}

function selectComparisonCheckedAt(comparison: ComparisonReport) {
  const siteATime = new Date(comparison.siteA.checkedAt).getTime();
  const siteBTime = new Date(comparison.siteB.checkedAt).getTime();
  if (!Number.isFinite(siteATime) && !Number.isFinite(siteBTime)) {
    return new Date().toISOString();
  }
  if (!Number.isFinite(siteATime)) {
    return new Date(siteBTime).toISOString();
  }
  if (!Number.isFinite(siteBTime)) {
    return new Date(siteATime).toISOString();
  }
  return new Date(Math.max(siteATime, siteBTime)).toISOString();
}

function buildRecommendation(
  siteAHeader: HeaderResult,
  siteBHeader: HeaderResult,
  siteALabel: string,
  siteBLabel: string
) {
  if (siteAHeader.status === "good" && siteBHeader.status === "good") {
    return "Both sites are configured well for this header.";
  }

  if (siteAHeader.status === "missing" && siteBHeader.status !== "missing") {
    return `${siteALabel}: ${siteAHeader.guidance}`;
  }
  if (siteBHeader.status === "missing" && siteAHeader.status !== "missing") {
    return `${siteBLabel}: ${siteBHeader.guidance}`;
  }

  if (siteAHeader.status !== "good" && siteBHeader.status === "good") {
    return `${siteALabel}: ${siteAHeader.guidance}`;
  }
  if (siteBHeader.status !== "good" && siteAHeader.status === "good") {
    return `${siteBLabel}: ${siteBHeader.guidance}`;
  }

  if (siteAHeader.status !== "good" && siteBHeader.status !== "good") {
    return `${siteALabel}: ${siteAHeader.guidance} ${siteBLabel}: ${siteBHeader.guidance}`;
  }

  return "Review values to align both sites.";
}

function ComparisonResultsSkeleton() {
  return (
    <div className="mt-6 space-y-5" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-slate-400">
        <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-sky-300" />
        Comparing headers...
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
          <div className="h-3 w-14 animate-pulse rounded bg-slate-800/80" />
          <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-slate-800/80" />
          <div className="mt-4 h-10 w-12 animate-pulse rounded bg-slate-800/80" />
          <div className="mt-3 h-4 w-24 animate-pulse rounded bg-slate-800/80" />
        </article>
        <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
          <div className="h-3 w-14 animate-pulse rounded bg-slate-800/80" />
          <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-slate-800/80" />
          <div className="mt-4 h-10 w-12 animate-pulse rounded bg-slate-800/80" />
          <div className="mt-3 h-4 w-24 animate-pulse rounded bg-slate-800/80" />
        </article>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-800/90">
        <div className="h-11 border-b border-slate-800/80 bg-slate-900/60" />
        <div className="space-y-0">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`compare-skeleton-${index}`} className="grid grid-cols-4 gap-3 border-t border-slate-800/70 px-4 py-3">
              <div className="h-4 w-24 animate-pulse rounded bg-slate-800/80" />
              <div className="h-4 w-20 animate-pulse rounded bg-slate-800/80" />
              <div className="h-4 w-20 animate-pulse rounded bg-slate-800/80" />
              <div className="h-4 w-40 animate-pulse rounded bg-slate-800/80" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function requestReport(targetUrl: string): Promise<ReportResponse> {
  const response = await fetch("/api/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: normalizeUrl(targetUrl) })
  });

  const payload = (await response.json().catch(() => null)) as { error?: unknown } | ReportResponse | null;
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit reached. Please wait and try again.");
    }

    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Unable to compare headers right now.";
    throw new Error(message);
  }

  return payload as ReportResponse;
}

export function ComparePageClient() {
  const { notify } = useToast();
  const { data: session, status: sessionStatus } = useSession();
  const [urlA, setUrlA] = useState("");
  const [urlB, setUrlB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ComparisonReport | null>(null);
  const [comparisonHistory, setComparisonHistory] = useState<ComparisonHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [historyBootstrapped, setHistoryBootstrapped] = useState(false);
  const [historyServerReady, setHistoryServerReady] = useState(false);
  const [syncedHistoryUserKey, setSyncedHistoryUserKey] = useState<string | null>(null);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false);

  const isAuthenticated = sessionStatus === "authenticated";
  const currentUserKey = session?.user?.email ?? session?.user?.name ?? null;
  const siteALabel = useMemo(() => extractHost(urlA || comparison?.siteA.checkedUrl || "Site A"), [comparison, urlA]);
  const siteBLabel = useMemo(() => extractHost(urlB || comparison?.siteB.checkedUrl || "Site B"), [comparison, urlB]);

  useEffect(() => {
    try {
      const rawComparisonHistory = localStorage.getItem(COMPARISON_HISTORY_STORAGE_KEY);
      const parsed = rawComparisonHistory ? (JSON.parse(rawComparisonHistory) as unknown) : [];
      const localEntries = Array.isArray(parsed)
        ? normalizeComparisonHistoryEntries(parsed.filter(isComparisonHistoryEntry))
        : [];
      setComparisonHistory(localEntries);
    } catch {
      setComparisonHistory([]);
    } finally {
      setHistoryBootstrapped(true);
    }
  }, []);

  useEffect(() => {
    try {
      const rawValue = localStorage.getItem(BROWSER_NOTIFICATIONS_ENABLED_STORAGE_KEY);
      setBrowserNotificationsEnabled(rawValue === "true");
    } catch {
      setBrowserNotificationsEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (!historyBootstrapped) return;
    try {
      if (comparisonHistory.length === 0) {
        localStorage.removeItem(COMPARISON_HISTORY_STORAGE_KEY);
      } else {
        localStorage.setItem(COMPARISON_HISTORY_STORAGE_KEY, JSON.stringify(comparisonHistory));
      }
    } catch {
      // Ignore storage failures in private mode.
    }
  }, [comparisonHistory, historyBootstrapped]);

  useEffect(() => {
    if (isAuthenticated) return;
    setHistoryServerReady(false);
    setSyncedHistoryUserKey(null);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !currentUserKey || !historyBootstrapped) return;
    if (syncedHistoryUserKey === currentUserKey) return;

    let cancelled = false;
    const localHistory = comparisonHistory;

    async function syncLocalAndRemoteHistory() {
      try {
        const response = await fetch("/api/user-data", { method: "GET", cache: "no-store" });
        const payload = response.ok
          ? ((await response.json()) as {
              comparisonHistory?: unknown;
              browserNotificationsEnabled?: unknown;
            })
          : null;

        const serverHistory =
          payload && Array.isArray(payload.comparisonHistory)
            ? normalizeComparisonHistoryEntries(payload.comparisonHistory)
            : [];
        const mergedHistory = mergeComparisonHistories(localHistory, serverHistory);
        const serverNotificationsEnabled =
          payload && typeof payload.browserNotificationsEnabled === "boolean"
            ? payload.browserNotificationsEnabled
            : null;

        if (cancelled) return;
        setComparisonHistory(mergedHistory);
        if (serverNotificationsEnabled !== null) {
          setBrowserNotificationsEnabled(serverNotificationsEnabled);
          try {
            localStorage.setItem(
              BROWSER_NOTIFICATIONS_ENABLED_STORAGE_KEY,
              serverNotificationsEnabled ? "true" : "false"
            );
          } catch {
            // Ignore storage failures.
          }
        }

        await fetch("/api/user-data", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comparisonHistory: mergedHistory })
        });
      } finally {
        if (!cancelled) {
          setHistoryServerReady(true);
          setSyncedHistoryUserKey(currentUserKey);
        }
      }
    }

    void syncLocalAndRemoteHistory();
    return () => {
      cancelled = true;
    };
  }, [
    comparisonHistory,
    currentUserKey,
    historyBootstrapped,
    isAuthenticated,
    syncedHistoryUserKey
  ]);

  useEffect(() => {
    if (!isAuthenticated || !currentUserKey || !historyServerReady) return;
    if (syncedHistoryUserKey !== currentUserKey) return;

    void fetch("/api/user-data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comparisonHistory })
    }).catch(() => {
      // Keep local history if server sync fails.
    });
  }, [
    comparisonHistory,
    currentUserKey,
    historyServerReady,
    isAuthenticated,
    syncedHistoryUserKey
  ]);

  const addComparisonToHistory = useCallback((nextComparison: ComparisonReport) => {
    const checkedAt = selectComparisonCheckedAt(nextComparison);
    const nextEntry: ComparisonHistoryEntry = {
      id: `${checkedAt}-${nextComparison.siteA.checkedUrl}-${nextComparison.siteB.checkedUrl}`,
      siteAUrl: nextComparison.siteA.checkedUrl,
      siteAGrade: nextComparison.siteA.grade,
      siteBUrl: nextComparison.siteB.checkedUrl,
      siteBGrade: nextComparison.siteB.grade,
      checkedAt
    };
    setComparisonHistory((previous) => normalizeComparisonHistoryEntries([nextEntry, ...previous]));
  }, []);

  const clearComparisonHistory = useCallback(() => {
    setComparisonHistory([]);
    if (!isAuthenticated) return;
    void fetch("/api/user-data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comparisonHistory: [] })
    }).catch(() => {
      // Keep local clear if server sync fails.
    });
  }, [isAuthenticated]);

  const saveReportsToHistory = useCallback(
    async (reports: ReportResponse[]) => {
      const entries: ScanHistoryEntry[] = reports.map((report) => ({
        id: `${report.checkedAt}-${report.checkedUrl}`,
        url: report.checkedUrl,
        grade: report.grade,
        checkedAt: report.checkedAt
      }));

      let nextHistory = normalizeScanHistoryEntries(entries);
      let nextDomainHistory = normalizeDomainGradeHistory(
        entries.reduce(
          (history, entry) =>
            recordDomainGradeHistoryPoint(history, {
              url: entry.url,
              grade: entry.grade,
              checkedAt: entry.checkedAt
            }),
          {}
        )
      );

      try {
        const localRaw = localStorage.getItem(HISTORY_STORAGE_KEY);
        const parsed = localRaw ? (JSON.parse(localRaw) as unknown) : [];
        const localEntries = Array.isArray(parsed) ? parsed.filter(isScanHistoryEntry) : [];
        nextHistory = normalizeScanHistoryEntries([...entries, ...localEntries]);
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));

        const localRawHistory = localStorage.getItem(DOMAIN_HISTORY_STORAGE_KEY);
        const parsedDomainHistory = localRawHistory ? (JSON.parse(localRawHistory) as unknown) : {};
        const localDomainHistory = normalizeDomainGradeHistory(parsedDomainHistory);
        nextDomainHistory = mergeDomainGradeHistories(nextDomainHistory, localDomainHistory);
        localStorage.setItem(DOMAIN_HISTORY_STORAGE_KEY, JSON.stringify(nextDomainHistory));
      } catch {
        // Ignore local storage failures (private mode or blocked storage).
      }

      if (!isAuthenticated) return;

      try {
        const response = await fetch("/api/user-data", { method: "GET", cache: "no-store" });
        const payload = response.ok
          ? ((await response.json()) as { scanHistory?: unknown; history?: unknown })
          : null;
        const serverEntries =
          payload && Array.isArray(payload.scanHistory) ? payload.scanHistory.filter(isScanHistoryEntry) : [];
        const merged = mergeScanHistories(nextHistory, serverEntries);
        const serverDomainHistory = normalizeDomainGradeHistory(payload?.history);
        const mergedDomainHistory = mergeDomainGradeHistories(nextDomainHistory, serverDomainHistory);

        await fetch("/api/user-data", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scanHistory: merged, history: mergedDomainHistory })
        });
      } catch {
        // Keep local history as fallback if server sync fails.
      }
    },
    [isAuthenticated]
  );

  const tableRows = useMemo(() => {
    if (!comparison) return [];
    const siteBByKey = new Map(comparison.siteB.results.map((result) => [result.key, result]));

    return comparison.siteA.results
      .map((siteAHeader) => {
        const siteBHeader = siteBByKey.get(siteAHeader.key);
        if (!siteBHeader) return null;

        const tone = comparisonTone(siteAHeader, siteBHeader);
        return {
          key: siteAHeader.key,
          label: siteAHeader.label,
          siteA: siteAHeader,
          siteB: siteBHeader,
          tone,
          recommendation: buildRecommendation(siteAHeader, siteBHeader, siteALabel, siteBLabel)
        };
      })
      .filter(
        (
          row
        ): row is {
          key: string;
          label: string;
          siteA: HeaderResult;
          siteB: HeaderResult;
          tone: ComparisonRowTone;
          recommendation: string;
        } => Boolean(row)
      );
  }, [comparison, siteALabel, siteBLabel]);

  const comparisonLiveMessage = useMemo(() => {
    if (error) {
      return `Comparison error: ${error}`;
    }
    if (loading) {
      return "Running two scans for comparison.";
    }
    if (comparison) {
      return `Comparison complete. ${siteALabel} grade ${comparison.siteA.grade}. ${siteBLabel} grade ${comparison.siteB.grade}.`;
    }
    return "";
  }, [comparison, error, loading, siteALabel, siteBLabel]);

  const runComparisonCheck = useCallback(async (siteAUrl: string, siteBUrl: string) => {
    if (!normalizeUrl(siteAUrl) || !normalizeUrl(siteBUrl)) {
      setError("Please enter both URLs before comparing.");
      return;
    }
    setLoading(true);
    setError(null);
    setComparison(null);

    try {
      const [siteA, siteB] = await Promise.all([requestReport(siteAUrl), requestReport(siteBUrl)]);
      const nextComparison = { siteA, siteB };
      setComparison(nextComparison);
      await saveReportsToHistory([siteA, siteB]);
      addComparisonToHistory(nextComparison);
      notify({ tone: "success", message: "Comparison complete." });

      if (browserNotificationsEnabled) {
        sendBrowserNotification("Comparison complete", {
          body: `${extractHost(siteA.checkedUrl)} (${siteA.grade}) vs ${extractHost(siteB.checkedUrl)} (${siteB.grade})`,
          tag: "comparison-complete"
        });
      }
    } catch (comparisonError) {
      const message = comparisonError instanceof Error ? comparisonError.message : "Comparison failed.";
      setError(message);
      notify({ tone: "error", message });
    } finally {
      setLoading(false);
    }
  }, [addComparisonToHistory, browserNotificationsEnabled, notify, saveReportsToHistory]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runComparisonCheck(urlA, urlB);
  }

  function onHistoryEntryClick(entry: ComparisonHistoryEntry) {
    setUrlA(entry.siteAUrl);
    setUrlB(entry.siteBUrl);
    void runComparisonCheck(entry.siteAUrl, entry.siteBUrl);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {comparisonLiveMessage}
      </p>
      <SiteNav />

      <section className="motion-card mb-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Comparison mode</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100 sm:text-4xl">
          Compare Security Headers Side by Side
        </h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Run two scans at once and review header differences in a single color-coded table. Green means both are
          strong, red means one site is missing protection, and yellow means one side is weak.
        </p>
      </section>

      <section className="motion-card rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="compare-page-site-a" className="mb-1 block text-xs uppercase tracking-[0.14em] text-slate-400">
                Site A URL
              </label>
              <input
                id="compare-page-site-a"
                type="text"
                value={urlA}
                onChange={(event) => setUrlA(event.target.value)}
                placeholder="example.com or https://example.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-5 py-3.5 text-base text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                required
              />
            </div>
            <div>
              <label htmlFor="compare-page-site-b" className="mb-1 block text-xs uppercase tracking-[0.14em] text-slate-400">
                Site B URL
              </label>
              <input
                id="compare-page-site-b"
                type="text"
                value={urlB}
                onChange={(event) => setUrlB(event.target.value)}
                placeholder="example.org or https://example.org"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-5 py-3.5 text-base text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                required
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              aria-label="Compare security headers for both URLs"
              className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {loading ? "Comparing..." : "Compare Headers"}
            </button>
            {loading && (
              <span className="inline-flex items-center gap-2 text-xs text-slate-300" aria-live="polite">
                <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-sky-300" />
                Running two scans...
              </span>
            )}
            <p className="text-xs text-slate-500">
              Works for everyone without auth. Signed-in users also get both scans saved to history.
            </p>
          </div>
        </form>

        {error && (
          <p
            role="alert"
            aria-live="assertive"
            className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
          >
            {error}
          </p>
        )}

        <section className="lazy-section mt-6 rounded-xl border border-slate-800/90 bg-slate-950/60">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              aria-expanded={historyOpen}
              aria-controls="recent-comparisons-list"
              aria-label={historyOpen ? "Collapse recent comparisons" : "Expand recent comparisons"}
              className="text-sm font-medium text-slate-200 transition hover:text-sky-200"
            >
              Recent Comparisons ({comparisonHistory.length}) {historyOpen ? "−" : "+"}
            </button>
            <button
              type="button"
              onClick={clearComparisonHistory}
              disabled={comparisonHistory.length === 0}
              aria-label="Clear comparison history"
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear history
            </button>
            {isAuthenticated && !historyServerReady && (
              <span className="text-xs text-slate-400" aria-live="polite">
                Syncing saved history...
              </span>
            )}
          </div>
          {historyOpen && (
            <div id="recent-comparisons-list" className="border-t border-slate-800/90 px-4 py-3">
              {!historyBootstrapped ? (
                <div className="space-y-2">
                  <div className="h-4 w-48 animate-pulse rounded bg-slate-800/80" />
                  <div className="h-4 w-64 animate-pulse rounded bg-slate-800/80" />
                </div>
              ) : comparisonHistory.length === 0 ? (
                <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
                  <div className="empty-state-float inline-flex rounded-lg border border-sky-500/30 bg-sky-500/10 p-2 text-sky-200">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <path
                        d="M5 6h6v12H5V6Zm8 0h6v12h-6V6ZM7 8v8h2V8H7Zm8 0v8h2V8h-2Z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    No comparisons yet. Run a comparison to store your latest side-by-side checks.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {comparisonHistory.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => onHistoryEntryClick(entry)}
                        disabled={loading}
                        aria-label={`Run comparison again for ${entry.siteAUrl} and ${entry.siteBUrl}`}
                        className="motion-card w-full rounded-lg border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-left transition hover:border-sky-500/60 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-slate-100">{entry.siteAUrl}</p>
                            <p className="truncate text-xs text-slate-500">{entry.siteBUrl}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              {new Date(entry.checkedAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`grade-badge-in text-lg font-semibold ${gradeColor(entry.siteAGrade)}`}>
                              {entry.siteAGrade}
                            </span>
                            <span className="text-slate-500">vs</span>
                            <span className={`grade-badge-in text-lg font-semibold ${gradeColor(entry.siteBGrade)}`}>
                              {entry.siteBGrade}
                            </span>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {loading && <ComparisonResultsSkeleton />}

        {comparison && (
          <div className="lazy-section mt-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <article className="motion-card rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Site A</p>
                <p className="mt-1 break-all text-sm text-slate-300">{comparison.siteA.checkedUrl}</p>
                <p className={`grade-badge-in mt-3 text-3xl font-bold sm:text-4xl ${gradeColor(comparison.siteA.grade)}`}>
                  {comparison.siteA.grade}
                </p>
                <p className="text-sm text-slate-300">
                  Score {comparison.siteA.score}/{comparison.siteA.results.length * 2}
                </p>
              </article>
              <article className="motion-card rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Site B</p>
                <p className="mt-1 break-all text-sm text-slate-300">{comparison.siteB.checkedUrl}</p>
                <p className={`grade-badge-in mt-3 text-3xl font-bold sm:text-4xl ${gradeColor(comparison.siteB.grade)}`}>
                  {comparison.siteB.grade}
                </p>
                <p className="text-sm text-slate-300">
                  Score {comparison.siteB.score}/{comparison.siteB.results.length * 2}
                </p>
              </article>
            </div>

            <article className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-sky-100">Overall grade comparison</p>
              <p className="mt-1 text-sm text-sky-200/90">{getGradeNarrative(comparison)}</p>
            </article>

            <p className="text-xs text-slate-400 sm:hidden">Scroll horizontally to view the full comparison table.</p>
            <section
              className="overflow-x-auto rounded-xl border border-slate-800/90"
              role="region"
              aria-label="Comparison result table. Scroll horizontally on mobile."
            >
              <table className="min-w-[840px] text-left text-sm">
                <thead className="bg-slate-900/70 text-xs uppercase tracking-[0.12em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Header</th>
                    <th className="px-4 py-3">{siteALabel}</th>
                    <th className="px-4 py-3">{siteBLabel}</th>
                    <th className="px-4 py-3">Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.key} className={`border-t transition hover:bg-slate-900/35 ${rowClasses(row.tone)}`}>
                      <td className="px-4 py-3 align-top">
                        <p className="font-semibold text-slate-100">{row.label}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold uppercase ring-1 ${statusClassNames[row.siteA.status]}`}
                        >
                          {row.siteA.status}
                        </span>
                        <p className="mt-2 break-all text-xs text-slate-400">{row.siteA.value ?? "Missing header"}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold uppercase ring-1 ${statusClassNames[row.siteB.status]}`}
                        >
                          {row.siteB.status}
                        </span>
                        <p className="mt-2 break-all text-xs text-slate-400">{row.siteB.value ?? "Missing header"}</p>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-slate-300">{row.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </section>

      <SiteFooter className="mt-10" />
    </main>
  );
}
