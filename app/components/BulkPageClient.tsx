"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { useToast } from "@/app/components/ToastProvider";
import type { HeaderResult } from "@/lib/securityHeaders";
import { BROWSER_NOTIFICATIONS_ENABLED_STORAGE_KEY } from "@/lib/userData";
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

type BulkScanResult = {
  inputUrl: string;
  report: ReportResponse | null;
  missingHeaders: string[];
  reportHref: string | null;
  error: string | null;
};

type SharePayload = {
  version: 1;
  mode: "single";
  report: ReportResponse;
};

type BulkResultFilter = "all" | "success" | "failed";
type BulkSortField = "grade" | "score" | "checkedAt";
type SortDirection = "asc" | "desc";

const MAX_BULK_URLS = 10;
const GRADE_RANK: Record<string, number> = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  F: 1
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

function extractDomain(value: string) {
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(withProtocol);
    return parsed.hostname || value;
  } catch {
    return value;
  }
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " <br/> ");
}

function formatCheckedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function scoreValue(entry: BulkScanResult) {
  if (!entry.report) return -1;
  return entry.report.score;
}

function checkedAtValue(entry: BulkScanResult) {
  if (!entry.report) return -1;
  const parsed = new Date(entry.report.checkedAt).getTime();
  return Number.isFinite(parsed) ? parsed : -1;
}

function gradeValue(entry: BulkScanResult) {
  if (!entry.report) return -1;
  return GRADE_RANK[entry.report.grade] ?? 0;
}

function toExportRow(entry: BulkScanResult): [string, string, string, string, string] {
  const report = entry.report;
  if (!report) {
    return [
      entry.inputUrl,
      "--",
      "--",
      entry.error ? `Scan failed: ${entry.error}` : "--",
      "--"
    ];
  }

  const score = `${report.score}/${report.results.length * 2}`;
  const missingHeaders = entry.missingHeaders.length > 0 ? entry.missingHeaders.join("; ") : "None";

  return [report.finalUrl || entry.inputUrl, report.grade, score, missingHeaders, formatCheckedAt(report.checkedAt)];
}

function buildMarkdownTable(entries: BulkScanResult[]): string {
  const header = ["URL", "Grade", "Score", "Missing Headers", "Checked At"];
  const separator = ["---", "---", "---", "---", "---"];
  const rows = entries.map((entry) => toExportRow(entry));

  return [
    `| ${header.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => escapeMarkdownCell(cell)).join(" | ")} |`)
  ].join("\n");
}

async function createSharedReportPath(report: ReportResponse): Promise<string | null> {
  const payload: SharePayload = { version: 1, mode: "single", report };
  const response = await fetch("/api/reports/share", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const body = (await response.json().catch(() => null)) as { path?: unknown } | null;
  if (!response.ok || !body || typeof body.path !== "string") {
    return null;
  }
  return body.path;
}

function missingHeaderLabels(report: ReportResponse): string[] {
  return report.results.filter((entry) => entry.status === "missing").map((entry) => entry.label);
}

function SuccessCheckIcon() {
  return (
    <span className="success-checkmark inline-flex items-center gap-1.5 text-emerald-300">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
        <path
          d="M3.2 8.4 6.5 11.4 12.8 4.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Complete
    </span>
  );
}

function BulkResultsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <section
      className="mt-6 overflow-hidden rounded-xl border border-slate-800/90"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-2 border-b border-slate-800/90 px-4 py-3 text-xs uppercase tracking-[0.12em] text-slate-400">
        <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-sky-300" />
        Running scans...
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] text-left text-sm">
          <thead className="bg-slate-900/70 text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-4 py-3">URL</th>
              <th className="px-4 py-3">Grade</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Missing headers</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, index) => (
              <tr key={`skeleton-row-${index}`} className="border-t border-slate-800/70">
                <td className="px-4 py-3">
                  <div className="h-4 w-56 animate-pulse rounded bg-slate-800/80" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-10 animate-pulse rounded bg-slate-800/80" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-16 animate-pulse rounded bg-slate-800/80" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-40 animate-pulse rounded bg-slate-800/80" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-800/80" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function requestReport(targetUrl: string): Promise<ReportResponse> {
  const response = await fetch("/api/check", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ url: normalizeUrl(targetUrl) })
  });

  const payload = (await response.json().catch(() => null)) as { error?: unknown } | ReportResponse | null;
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit reached. Please wait a moment and try again.");
    }

    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Unable to check headers right now.";
    throw new Error(message);
  }

  return payload as ReportResponse;
}

export function BulkPageClient() {
  const { notify } = useToast();
  const { data: session, status: sessionStatus } = useSession();
  const [bulkUrlsInput, setBulkUrlsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkScanResult[]>([]);
  const [bulkExportState, setBulkExportState] = useState<"idle" | "exported" | "error">("idle");
  const [bulkCopyState, setBulkCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [resultFilter, setResultFilter] = useState<BulkResultFilter>("all");
  const [sortField, setSortField] = useState<BulkSortField>("checkedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [detailsTarget, setDetailsTarget] = useState<BulkScanResult | null>(null);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false);
  const [bulkTargetCount, setBulkTargetCount] = useState(0);
  const [bulkCompletedCount, setBulkCompletedCount] = useState(0);

  const isAuthenticated = sessionStatus === "authenticated";
  const currentUserKey = session?.user?.email ?? session?.user?.name ?? null;
  const enteredUrlCount = useMemo(() => {
    return bulkUrlsInput
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean).length;
  }, [bulkUrlsInput]);
  const bulkProgressPercent = useMemo(() => {
    if (bulkTargetCount === 0) return 0;
    return Math.round((bulkCompletedCount / bulkTargetCount) * 100);
  }, [bulkCompletedCount, bulkTargetCount]);

  useEffect(() => {
    try {
      const localValue = localStorage.getItem(BROWSER_NOTIFICATIONS_ENABLED_STORAGE_KEY);
      setBrowserNotificationsEnabled(localValue === "true");
    } catch {
      setBrowserNotificationsEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !currentUserKey) return;
    let cancelled = false;

    async function syncNotificationPreference() {
      try {
        const response = await fetch("/api/user-data", { method: "GET", cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { browserNotificationsEnabled?: unknown };
        if (cancelled || typeof payload.browserNotificationsEnabled !== "boolean") return;
        setBrowserNotificationsEnabled(payload.browserNotificationsEnabled);
        try {
          localStorage.setItem(
            BROWSER_NOTIFICATIONS_ENABLED_STORAGE_KEY,
            payload.browserNotificationsEnabled ? "true" : "false"
          );
        } catch {
          // Ignore storage failures.
        }
      } catch {
        // Keep local setting fallback.
      }
    }

    void syncNotificationPreference();
    return () => {
      cancelled = true;
    };
  }, [currentUserKey, isAuthenticated]);

  const filteredAndSortedResults = useMemo(() => {
    const filtered =
      resultFilter === "all"
        ? results
        : results.filter((entry) => (resultFilter === "success" ? Boolean(entry.report) : Boolean(entry.error)));

    return [...filtered].sort((left, right) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;
      let difference = 0;
      if (sortField === "grade") {
        difference = gradeValue(left) - gradeValue(right);
      } else if (sortField === "score") {
        difference = scoreValue(left) - scoreValue(right);
      } else {
        difference = checkedAtValue(left) - checkedAtValue(right);
      }
      if (difference !== 0) {
        return difference * multiplier;
      }
      return left.inputUrl.localeCompare(right.inputUrl) * multiplier;
    });
  }, [resultFilter, results, sortDirection, sortField]);

  const bulkLiveMessage = useMemo(() => {
    if (error) {
      return `Bulk scan error: ${error}`;
    }
    if (loading && bulkTargetCount > 0) {
      return `Running bulk scan. ${bulkCompletedCount} of ${bulkTargetCount} complete.`;
    }
    if (!loading && results.length > 0) {
      const successCount = results.filter((entry) => entry.report).length;
      return `Bulk scan finished. ${successCount} of ${results.length} scans succeeded.`;
    }
    return "";
  }, [bulkCompletedCount, bulkTargetCount, error, loading, results]);

  function toggleSort(nextField: BulkSortField) {
    setSortField((currentField) => {
      if (currentField === nextField) {
        setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
        return currentField;
      }
      setSortDirection("desc");
      return nextField;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const targets = bulkUrlsInput
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (targets.length === 0) {
      setError("Please enter at least one URL.");
      setResults([]);
      setBulkTargetCount(0);
      setBulkCompletedCount(0);
      return;
    }

    if (targets.length > MAX_BULK_URLS) {
      setError(`Bulk scanning supports up to ${MAX_BULK_URLS} URLs per run.`);
      setResults([]);
      setBulkTargetCount(0);
      setBulkCompletedCount(0);
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setBulkExportState("idle");
    setBulkCopyState("idle");
    setDetailsTarget(null);
    setBulkTargetCount(targets.length);
    setBulkCompletedCount(0);

    try {
      let completed = 0;
      const settled = await Promise.allSettled(
        targets.map(async (target) => {
          try {
            return await requestReport(target);
          } finally {
            completed += 1;
            setBulkCompletedCount(completed);
          }
        })
      );
      const nextResults = settled.map((result, index): BulkScanResult => {
        if (result.status === "fulfilled") {
          const report = result.value;
          return {
            inputUrl: targets[index],
            report,
            missingHeaders: missingHeaderLabels(report),
            reportHref: null,
            error: null
          };
        }

        const reasonMessage =
          result.reason instanceof Error ? result.reason.message : "Unable to check headers.";
        return {
          inputUrl: targets[index],
          report: null,
          missingHeaders: [],
          reportHref: null,
          error: reasonMessage
        };
      });

      const nextResultsWithShareLinks = await Promise.all(
        nextResults.map(async (entry) => {
          if (!entry.report) {
            return entry;
          }
          const reportHref = await createSharedReportPath(entry.report).catch(() => null);
          return {
            ...entry,
            reportHref
          };
        })
      );

      const failedCount = nextResultsWithShareLinks.filter((entry) => entry.error).length;
      setResults(nextResultsWithShareLinks);

      if (failedCount > 0) {
        const message = `${failedCount} of ${nextResultsWithShareLinks.length} scans failed. Review the table for details.`;
        setError(message);
        notify({ tone: "error", message });
      } else {
        notify({
          tone: "success",
          message: `Scanned ${nextResultsWithShareLinks.length} URL${nextResultsWithShareLinks.length === 1 ? "" : "s"}.`
        });
      }

      if (browserNotificationsEnabled) {
        const successfulReports = nextResultsWithShareLinks
          .map((entry) => entry.report)
          .filter((entry): entry is ReportResponse => Boolean(entry));
        if (successfulReports.length === 1) {
          const single = successfulReports[0];
          sendBrowserNotification("Scan complete", {
            body: `${extractDomain(single.checkedUrl)} earned grade ${single.grade}.`,
            tag: "bulk-scan-complete"
          });
        } else if (successfulReports.length > 1) {
          const bestGrade = [...successfulReports].sort(
            (left, right) => (GRADE_RANK[right.grade] ?? 0) - (GRADE_RANK[left.grade] ?? 0)
          )[0]?.grade;
          sendBrowserNotification("Bulk scan complete", {
            body: `${successfulReports.length}/${nextResultsWithShareLinks.length} succeeded${bestGrade ? `. Best grade: ${bestGrade}.` : "."}`,
            tag: "bulk-scan-complete"
          });
        } else {
          sendBrowserNotification("Bulk scan complete", {
            body: "All scans failed. Review the table for details.",
            tag: "bulk-scan-complete"
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }

  function onDownloadCsv() {
    if (results.length === 0) return;

    try {
      const headerRow = ["URL", "Grade", "Score", "Missing Headers", "Checked At"];
      const dataRows = results.map((entry) => toExportRow(entry));
      const csvContent = [headerRow, ...dataRows]
        .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
        .join("\n");

      const blob = new Blob(["\uFEFF", csvContent], { type: "text/csv;charset=utf-8;" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `bulk-scan-results-${Date.now()}.csv`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      setBulkExportState("exported");
      notify({ tone: "success", message: "Bulk scan results downloaded as CSV." });
    } catch {
      setBulkExportState("error");
      notify({ tone: "error", message: "Could not download CSV. Please try again." });
    } finally {
      window.setTimeout(() => setBulkExportState("idle"), 2500);
    }
  }

  async function onCopyMarkdownTable() {
    if (filteredAndSortedResults.length === 0) return;

    try {
      await navigator.clipboard.writeText(buildMarkdownTable(filteredAndSortedResults));
      setBulkCopyState("copied");
      notify({ tone: "success", message: "Bulk scan markdown table copied." });
    } catch {
      setBulkCopyState("error");
      notify({ tone: "error", message: "Clipboard unavailable. Copy manually instead." });
    } finally {
      window.setTimeout(() => setBulkCopyState("idle"), 2500);
    }
  }

  useEffect(() => {
    if (!detailsTarget) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDetailsTarget(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailsTarget]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {bulkLiveMessage}
      </p>
      <SiteNav />

      <section className="motion-card mb-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Bulk scan mode</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100 sm:text-4xl">Scan up to 10 URLs at once</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Paste one URL per line to run multiple scans together. Compare grades, identify missing headers quickly, and
          open a full report for any row.
        </p>
      </section>

      <section className="motion-card rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="bulk-page-urls" className="mb-1 block text-xs uppercase tracking-[0.14em] text-slate-400">
              URLs (one per line)
            </label>
            <textarea
              id="bulk-page-urls"
              value={bulkUrlsInput}
              onChange={(event) => setBulkUrlsInput(event.target.value)}
              placeholder={"example.com\nhttps://mozilla.org\ncloudflare.com"}
              rows={8}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-5 py-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              required
            />
            <p className="mt-2 text-xs text-slate-500">
              {enteredUrlCount}/{MAX_BULK_URLS} URLs entered. Works for anonymous and signed-in users. Rate limits
              still apply.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {loading ? "Scanning..." : "Scan All"}
            </button>
            {loading && (
              <span className="inline-flex items-center gap-2 text-xs text-slate-300" aria-live="polite">
                <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-sky-300" />
                Collecting reports... {bulkProgressPercent}%
              </span>
            )}
            <p className="text-xs text-slate-500">{isAuthenticated ? "Signed in: higher per-minute limit." : "Not signed in: standard per-minute limit."}</p>
          </div>
        </form>

        {loading && bulkTargetCount > 0 && (
          <section
            className="mt-4 rounded-xl border border-slate-800/90 bg-slate-950/70 px-3 py-3"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-2">
                Running bulk scan...
                {bulkProgressPercent === 100 && <SuccessCheckIcon />}
              </span>
              <span>
                {bulkCompletedCount}/{bulkTargetCount} • {bulkProgressPercent}%
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-slate-800"
              role="progressbar"
              aria-label="Bulk scan progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={bulkProgressPercent}
            >
              <div
                className="progress-pulse h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-[width] duration-200 will-change-[width]"
                style={{ width: `${bulkProgressPercent}%` }}
              />
            </div>
          </section>
        )}

        {error && (
          <p
            role="alert"
            aria-live="assertive"
            className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
          >
            {error}
          </p>
        )}

        {loading && <BulkResultsSkeleton rows={Math.max(enteredUrlCount, 3)} />}

        {results.length > 0 && (
          <section className="lazy-section mt-6 rounded-xl border border-slate-800/90">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 px-4 py-3">
              <div className="flex items-center gap-2">
                <label htmlFor="bulk-result-filter" className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  Filter
                </label>
                <select
                  id="bulk-result-filter"
                  value={resultFilter}
                  onChange={(event) => setResultFilter(event.target.value as BulkResultFilter)}
                  className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-200 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                >
                  <option value="all">All</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <p className="text-xs text-slate-500">
                Showing {filteredAndSortedResults.length} of {results.length} rows
              </p>
            </div>
            <p className="border-b border-slate-800/90 px-4 py-2 text-xs text-slate-400 sm:hidden">
              Scroll horizontally to view all columns.
            </p>
            <div
              className="overflow-x-auto"
              role="region"
              aria-label="Bulk scan results table. Scroll horizontally on mobile."
            >
              <table className="min-w-[980px] text-left text-sm">
                <thead className="bg-slate-900/70 text-xs uppercase tracking-[0.12em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">URL</th>
                    <th
                      className="px-4 py-3"
                      aria-sort={
                        sortField === "grade" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                      }
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort("grade")}
                        aria-label="Sort rows by grade"
                        className="inline-flex items-center gap-1 text-slate-300 transition hover:text-sky-200"
                      >
                        Grade
                        {sortField === "grade" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                      </button>
                    </th>
                    <th
                      className="px-4 py-3"
                      aria-sort={
                        sortField === "score" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                      }
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort("score")}
                        aria-label="Sort rows by score"
                        className="inline-flex items-center gap-1 text-slate-300 transition hover:text-sky-200"
                      >
                        Score
                        {sortField === "score" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                      </button>
                    </th>
                    <th className="px-4 py-3">Missing headers</th>
                    <th
                      className="px-4 py-3"
                      aria-sort={
                        sortField === "checkedAt" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                      }
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort("checkedAt")}
                        aria-label="Sort rows by checked time"
                        className="inline-flex items-center gap-1 text-slate-300 transition hover:text-sky-200"
                      >
                        Checked at
                        {sortField === "checkedAt" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                      </button>
                    </th>
                    <th className="px-4 py-3">Full report</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedResults.length === 0 ? (
                    <tr className="border-t border-slate-800/70">
                      <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-400">
                        No rows match this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedResults.map((entry, index) => (
                      <tr
                        key={`${entry.inputUrl}-${index}`}
                        className="border-t border-slate-800/70 transition hover:bg-slate-900/45"
                      >
                        <td className="px-4 py-3 align-top text-slate-200">
                          <p className="max-w-[320px] break-all">{entry.inputUrl}</p>
                          {entry.report && <p className="mt-1 max-w-[320px] break-all text-xs text-slate-500">{entry.report.finalUrl}</p>}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {entry.report ? (
                            <span
                              className={`grade-badge-in text-lg font-semibold ${gradeColor(entry.report.grade)}`}
                              style={{ animationDelay: `${index * 45}ms` }}
                            >
                              {entry.report.grade}
                            </span>
                          ) : (
                            <span className="text-lg font-semibold text-rose-300">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-slate-300">
                          {entry.report ? `${entry.report.score}/${entry.report.results.length * 2}` : "--"}
                        </td>
                        <td className="px-4 py-3 align-top text-slate-300">
                          {entry.report ? (
                            entry.missingHeaders.length > 0 ? (
                              <ul className="space-y-1">
                                {entry.missingHeaders.map((header) => (
                                  <li key={header} className="text-xs">
                                    {header}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-emerald-300">None</span>
                            )
                          ) : (
                            "--"
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-slate-400">
                          {entry.report ? formatCheckedAt(entry.report.checkedAt) : "--"}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {entry.reportHref ? (
                            <Link
                              href={entry.reportHref}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Open full report for ${entry.inputUrl}`}
                              className="text-sky-300 transition hover:text-sky-200"
                            >
                              Open full report
                            </Link>
                          ) : (
                            <span className="text-slate-500">Unavailable</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-slate-300">
                          {entry.error ? entry.error : <SuccessCheckIcon />}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <button
                            type="button"
                            onClick={() => setDetailsTarget(entry)}
                            disabled={!entry.report}
                            aria-label={`View full scan details for ${entry.inputUrl}`}
                            className="rounded-md border border-slate-700 px-2 py-1.5 text-xs text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/90 px-4 py-3">
              <button
                type="button"
                onClick={onDownloadCsv}
                aria-label="Download bulk scan results as CSV"
                className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
              >
                {bulkExportState === "exported" ? "CSV downloaded" : "Download CSV"}
              </button>
              <button
                type="button"
                onClick={onCopyMarkdownTable}
                aria-label="Copy bulk scan results as markdown table"
                className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
              >
                {bulkCopyState === "copied" ? "Markdown copied" : "Markdown Copy"}
              </button>
              {bulkExportState === "error" && <p className="text-xs text-rose-300">Could not download CSV. Try again.</p>}
              {bulkCopyState === "error" && <p className="text-xs text-rose-300">Could not copy markdown table. Try again.</p>}
            </div>
          </section>
        )}

        {detailsTarget?.report && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-scan-details-title"
          >
            <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl shadow-slate-950/70">
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
                <div>
                  <h2 id="bulk-scan-details-title" className="text-lg font-semibold text-slate-100">
                    Full scan details
                  </h2>
                  <p className="mt-1 break-all text-xs text-slate-400">{detailsTarget.report.checkedUrl}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailsTarget(null)}
                  aria-label="Close full scan details"
                  className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
                <div className="grid gap-4 rounded-lg border border-slate-800/90 bg-slate-900/70 p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Grade</p>
                    <p className={`mt-1 text-3xl font-bold ${gradeColor(detailsTarget.report.grade)}`}>
                      {detailsTarget.report.grade}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Score</p>
                    <p className="mt-1 text-xl font-semibold text-slate-100">
                      {detailsTarget.report.score}/{detailsTarget.report.results.length * 2}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Checked at</p>
                    <p className="mt-1 text-sm text-slate-300">
                      {formatCheckedAt(detailsTarget.report.checkedAt)}
                    </p>
                  </div>
                </div>

                <div
                  className="mt-4 overflow-x-auto rounded-lg border border-slate-800/90"
                  role="region"
                  aria-label="Detailed header status table"
                >
                  <table className="min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-900/70 text-xs uppercase tracking-[0.12em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Header</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Value</th>
                        <th className="px-4 py-3">Guidance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsTarget.report.results.map((header) => (
                        <tr key={header.key} className="border-t border-slate-800/70">
                          <td className="px-4 py-3 align-top text-slate-100">{header.label}</td>
                          <td className="px-4 py-3 align-top">
                            <span className="inline-flex rounded-full border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs uppercase text-slate-200">
                              {header.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top text-xs text-slate-300">
                            {header.value ?? "Missing header"}
                          </td>
                          <td className="px-4 py-3 align-top text-xs text-slate-300">{header.guidance}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <SiteFooter className="mt-10" />
    </main>
  );
}
