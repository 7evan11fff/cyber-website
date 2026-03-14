"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TrendChart } from "@/app/components/TrendChart";
import { getAllHeaderInfo } from "@/lib/securityHeaders";
import { gradeToScore, sortHistoryAscending } from "@/lib/gradeTrends";
import {
  DOMAIN_HISTORY_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
  WATCHLIST_STORAGE_KEY,
  getDomainKeyFromUrl,
  isScanHistoryEntry,
  isWatchlistEntry,
  mergeDomainGradeHistories,
  mergeScanHistories,
  mergeWatchlists,
  normalizeDomainGradeHistory,
  type DomainGradeHistoryPoint,
  type DomainGradeHistoryRecord,
  type ScanHistoryEntry,
  type WatchlistEntry
} from "@/lib/userData";

type TrendDirection = "up" | "down" | "flat" | "baseline";
type HeaderStatus = "good" | "weak" | "missing" | "unknown";

type TrendWindow = {
  direction: TrendDirection;
  percentChange: number | null;
  fromGrade: string | null;
  toGrade: string | null;
  sampleCount: number;
};

type TimelineHeaderChange = {
  key: string;
  label: string;
  from: HeaderStatus;
  to: HeaderStatus;
};

type TimelineEntry = {
  id: string;
  checkedAt: string;
  grade: string;
  gradeDelta: number | null;
  headerChanges: TimelineHeaderChange[];
};

type DomainTrendRow = {
  domain: string;
  displayUrl: string;
  latestGrade: string;
  latestCheckedAt: string | null;
  points: DomainGradeHistoryPoint[];
  trend7: TrendWindow;
  trend30: TrendWindow;
  timeline: TimelineEntry[];
};

type TrendSummary = {
  totalDomains: number;
  averageScore: number | null;
  averageGrade: string;
  improvedThisWeek: number;
  regressedThisWeek: number;
};

type DashboardTrendsClientProps = {
  initialWatchlist: WatchlistEntry[];
  initialScanHistory: ScanHistoryEntry[];
  initialHistory: DomainGradeHistoryRecord;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_ORDER: Record<HeaderStatus, number> = {
  good: 3,
  weak: 2,
  missing: 1,
  unknown: 0
};

function scoreToGrade(score: number): string {
  if (score >= 4.5) return "A";
  if (score >= 3.5) return "B";
  if (score >= 2.5) return "C";
  if (score >= 1.5) return "D";
  return "F";
}

function formatDateTime(input: string | null): string {
  if (!input) return "N/A";
  const parsed = new Date(input);
  if (!Number.isFinite(parsed.getTime())) return input;
  return parsed.toLocaleString();
}

function formatPercent(value: number | null): string {
  if (value === null) return "Baseline";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function asPercentChange(from: number, to: number): number | null {
  if (from <= 0) return null;
  return ((to - from) / from) * 100;
}

function computeWindowTrend(points: DomainGradeHistoryPoint[], days: number): TrendWindow {
  if (points.length < 2) {
    return {
      direction: "baseline",
      percentChange: null,
      fromGrade: points[0]?.grade ?? null,
      toGrade: points[points.length - 1]?.grade ?? null,
      sampleCount: points.length
    };
  }

  const sorted = sortHistoryAscending(points).filter((point) => {
    const timestamp = new Date(point.checkedAt).getTime();
    return Number.isFinite(timestamp) && gradeToScore(point.grade) > 0;
  });
  if (sorted.length < 2) {
    return {
      direction: "baseline",
      percentChange: null,
      fromGrade: sorted[0]?.grade ?? null,
      toGrade: sorted[sorted.length - 1]?.grade ?? null,
      sampleCount: sorted.length
    };
  }

  const latestPoint = sorted[sorted.length - 1];
  const latestTime = new Date(latestPoint.checkedAt).getTime();
  const cutoff = latestTime - days * DAY_MS;
  const windowPoints = sorted.filter((point) => new Date(point.checkedAt).getTime() >= cutoff);
  if (windowPoints.length < 2) {
    return {
      direction: "baseline",
      percentChange: null,
      fromGrade: windowPoints[0]?.grade ?? latestPoint.grade,
      toGrade: latestPoint.grade,
      sampleCount: windowPoints.length
    };
  }

  const firstPoint = windowPoints[0];
  const fromScore = gradeToScore(firstPoint.grade);
  const toScore = gradeToScore(latestPoint.grade);
  const percentChange = asPercentChange(fromScore, toScore);
  const direction: TrendDirection = toScore > fromScore ? "up" : toScore < fromScore ? "down" : "flat";
  return {
    direction,
    percentChange,
    fromGrade: firstPoint.grade,
    toGrade: latestPoint.grade,
    sampleCount: windowPoints.length
  };
}

function compareHeaderStatuses(
  current: ScanHistoryEntry["headerStatuses"],
  previous: ScanHistoryEntry["headerStatuses"],
  labelByKey: Map<string, string>
): TimelineHeaderChange[] {
  if (!current && !previous) return [];
  const keySet = new Set<string>([...Object.keys(current ?? {}), ...Object.keys(previous ?? {})]);
  const changes: TimelineHeaderChange[] = [];
  for (const key of keySet) {
    const from = (previous?.[key] ?? "unknown") as HeaderStatus;
    const to = (current?.[key] ?? "unknown") as HeaderStatus;
    if (from === to) continue;
    changes.push({
      key,
      label: labelByKey.get(key) ?? key,
      from,
      to
    });
  }

  return changes.sort((a, b) => {
    if (a.label === b.label) {
      return STATUS_ORDER[b.to] - STATUS_ORDER[a.to];
    }
    return a.label.localeCompare(b.label);
  });
}

function buildTimeline(scans: ScanHistoryEntry[], labelByKey: Map<string, string>): TimelineEntry[] {
  if (scans.length === 0) return [];
  const sorted = [...scans].sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());
  return sorted.map((entry, index) => {
    const older = sorted[index + 1];
    const currentScore = gradeToScore(entry.grade);
    const olderScore = older ? gradeToScore(older.grade) : 0;
    return {
      id: entry.id,
      checkedAt: entry.checkedAt,
      grade: entry.grade,
      gradeDelta: older ? currentScore - olderScore : null,
      headerChanges: compareHeaderStatuses(entry.headerStatuses, older?.headerStatuses, labelByKey)
    };
  });
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function statusTone(status: HeaderStatus): string {
  if (status === "good") return "text-emerald-300";
  if (status === "weak") return "text-amber-300";
  if (status === "missing") return "text-rose-300";
  return "text-slate-400";
}

function trendTone(direction: TrendDirection): string {
  if (direction === "up") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (direction === "down") return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  return "border-slate-700 bg-slate-900/80 text-slate-300";
}

function TrendArrow({ direction }: { direction: TrendDirection }) {
  if (direction === "up") {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M8 2 13 8H9.5V14h-3V8H3l5-6Z" fill="currentColor" />
      </svg>
    );
  }
  if (direction === "down") {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M8 14 3 8h3.5V2h3v6H13l-5 6Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M3 8h10v2H3z" fill="currentColor" />
    </svg>
  );
}

function TrendIndicator({ label, trend }: { label: string; trend: TrendWindow }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${trendTone(trend.direction)}`}>
      <TrendArrow direction={trend.direction} />
      <span>{label}</span>
      <span>{formatPercent(trend.percentChange)}</span>
      {trend.fromGrade && trend.toGrade ? <span>{`${trend.fromGrade} -> ${trend.toGrade}`}</span> : null}
    </span>
  );
}

function safeTimestamp(value: string | null): number {
  if (!value) return -1;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : -1;
}

export function DashboardTrendsClient({
  initialWatchlist,
  initialScanHistory,
  initialHistory
}: DashboardTrendsClientProps) {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>(initialWatchlist);
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>(initialScanHistory);
  const [history, setHistory] = useState<DomainGradeHistoryRecord>(initialHistory);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [pdfState, setPdfState] = useState<"idle" | "generating" | "error" | "exported">("idle");
  const [csvState, setCsvState] = useState<"idle" | "error" | "exported">("idle");

  useEffect(() => {
    try {
      const rawWatchlist = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      const parsedWatchlist = rawWatchlist ? (JSON.parse(rawWatchlist) as unknown) : [];
      const localWatchlist = Array.isArray(parsedWatchlist) ? parsedWatchlist.filter(isWatchlistEntry) : [];
      setWatchlist((current) => mergeWatchlists(current, localWatchlist));
    } catch {
      // Ignore local storage parse failures.
    }

    try {
      const rawScanHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      const parsedScanHistory = rawScanHistory ? (JSON.parse(rawScanHistory) as unknown) : [];
      const localScanHistory = Array.isArray(parsedScanHistory)
        ? parsedScanHistory.filter(isScanHistoryEntry)
        : [];
      setScanHistory((current) => mergeScanHistories(current, localScanHistory));
    } catch {
      // Ignore local storage parse failures.
    }

    try {
      const rawDomainHistory = localStorage.getItem(DOMAIN_HISTORY_STORAGE_KEY);
      const parsedDomainHistory = rawDomainHistory ? JSON.parse(rawDomainHistory) : {};
      const localHistory = normalizeDomainGradeHistory(parsedDomainHistory);
      setHistory((current) => mergeDomainGradeHistories(current, localHistory));
    } catch {
      // Ignore local storage parse failures.
    }
  }, []);

  const labelByKey = useMemo(() => {
    return new Map<string, string>(getAllHeaderInfo().map((header) => [header.key, header.label]));
  }, []);

  const domainRows = useMemo<DomainTrendRow[]>(() => {
    const scanByDomain = new Map<string, ScanHistoryEntry[]>();
    const historyFromScan: DomainGradeHistoryRecord = {};

    for (const entry of scanHistory) {
      const domain = getDomainKeyFromUrl(entry.url);
      if (!domain) continue;
      const existing = scanByDomain.get(domain);
      if (existing) {
        existing.push(entry);
      } else {
        scanByDomain.set(domain, [entry]);
      }
      historyFromScan[domain] = [...(historyFromScan[domain] ?? []), { grade: entry.grade, checkedAt: entry.checkedAt }];
    }

    const mergedHistory = mergeDomainGradeHistories(history, historyFromScan);

    const watchlistByDomain = new Map<string, WatchlistEntry>();
    for (const entry of watchlist) {
      const domain = getDomainKeyFromUrl(entry.url);
      if (!domain) continue;
      const existing = watchlistByDomain.get(domain);
      if (!existing || new Date(entry.lastCheckedAt).getTime() > new Date(existing.lastCheckedAt).getTime()) {
        watchlistByDomain.set(domain, entry);
      }
    }

    const domainSet = new Set<string>([
      ...Object.keys(mergedHistory),
      ...Array.from(scanByDomain.keys()),
      ...Array.from(watchlistByDomain.keys())
    ]);

    const rows: DomainTrendRow[] = [];
    for (const domain of domainSet) {
      const points = sortHistoryAscending(mergedHistory[domain] ?? []);
      const latestPoint = points[points.length - 1] ?? null;
      const watchlistEntry = watchlistByDomain.get(domain);
      const latestCheckedAt = latestPoint?.checkedAt ?? watchlistEntry?.lastCheckedAt ?? null;
      const latestGrade = latestPoint?.grade ?? watchlistEntry?.lastGrade ?? "--";
      const displayUrl = watchlistEntry?.url ?? domain;

      rows.push({
        domain,
        displayUrl,
        latestGrade,
        latestCheckedAt,
        points,
        trend7: computeWindowTrend(points, 7),
        trend30: computeWindowTrend(points, 30),
        timeline: buildTimeline(scanByDomain.get(domain) ?? [], labelByKey)
      });
    }

    return rows.sort((a, b) => {
      const timeDelta = safeTimestamp(b.latestCheckedAt) - safeTimestamp(a.latestCheckedAt);
      if (timeDelta !== 0) return timeDelta;
      return a.domain.localeCompare(b.domain);
    });
  }, [history, labelByKey, scanHistory, watchlist]);

  const summary = useMemo<TrendSummary>(() => {
    const latestScores = domainRows
      .map((row) => gradeToScore(row.latestGrade))
      .filter((score): score is number => score > 0);
    const averageScore =
      latestScores.length > 0 ? latestScores.reduce((sum, score) => sum + score, 0) / latestScores.length : null;
    return {
      totalDomains: domainRows.length,
      averageScore,
      averageGrade: averageScore === null ? "--" : scoreToGrade(averageScore),
      improvedThisWeek: domainRows.filter((row) => row.trend7.direction === "up").length,
      regressedThisWeek: domainRows.filter((row) => row.trend7.direction === "down").length
    };
  }, [domainRows]);

  async function onExportPdf() {
    if (domainRows.length === 0 || pdfState === "generating") return;
    setPdfState("generating");
    try {
      const { buildTrendReportPdfBlob } = await import("@/lib/trendReport");
      const blob = await buildTrendReportPdfBlob({
        summary: {
          totalDomains: summary.totalDomains,
          averageGrade: summary.averageGrade,
          averageScore: summary.averageScore,
          improvedThisWeek: summary.improvedThisWeek,
          regressedThisWeek: summary.regressedThisWeek
        },
        domains: domainRows.map((row) => ({
          domain: row.domain,
          latestGrade: row.latestGrade,
          latestCheckedAt: row.latestCheckedAt,
          change7Percent: row.trend7.percentChange,
          change30Percent: row.trend30.percentChange,
          recentChanges: (row.timeline[0]?.headerChanges ?? []).map(
            (change) => `${change.label}: ${change.from} -> ${change.to}`
          )
        }))
      });

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `watchlist-trends-${Date.now()}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setPdfState("exported");
      window.setTimeout(() => setPdfState("idle"), 2500);
    } catch {
      setPdfState("error");
      window.setTimeout(() => setPdfState("idle"), 2500);
    }
  }

  function onExportCsv() {
    if (domainRows.length === 0) return;
    try {
      const headers = [
        "Domain",
        "Display URL",
        "Latest Grade",
        "Latest Checked At",
        "7d Trend %",
        "7d Range",
        "30d Trend %",
        "30d Range",
        "Timeline Entries",
        "Latest Header Changes"
      ];
      const rows = domainRows.map((row) => {
        const latestHeaderChanges =
          row.timeline[0]?.headerChanges.map((change) => `${change.label}: ${change.from} -> ${change.to}`).join(" | ") ??
          "";
        return [
          row.domain,
          row.displayUrl,
          row.latestGrade,
          row.latestCheckedAt ?? "",
          row.trend7.percentChange === null ? "" : row.trend7.percentChange.toFixed(2),
          row.trend7.fromGrade && row.trend7.toGrade ? `${row.trend7.fromGrade} -> ${row.trend7.toGrade}` : "",
          row.trend30.percentChange === null ? "" : row.trend30.percentChange.toFixed(2),
          row.trend30.fromGrade && row.trend30.toGrade ? `${row.trend30.fromGrade} -> ${row.trend30.toGrade}` : "",
          String(row.timeline.length),
          latestHeaderChanges
        ];
      });

      const csv = [headers, ...rows].map((row) => row.map((cell) => escapeCsvCell(String(cell))).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `watchlist-trends-${Date.now()}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setCsvState("exported");
      window.setTimeout(() => setCsvState("idle"), 2500);
    } catch {
      setCsvState("error");
      window.setTimeout(() => setCsvState("idle"), 2500);
    }
  }

  return (
    <section className="lazy-section space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/50">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Total domains monitored</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{summary.totalDomains}</p>
        </article>
        <article className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/50">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Average grade</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">
            {summary.averageGrade}
            {summary.averageScore !== null ? (
              <span className="ml-1 text-sm font-medium text-slate-400">({summary.averageScore.toFixed(2)}/5)</span>
            ) : null}
          </p>
        </article>
        <article className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-lg shadow-slate-950/50">
          <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">Improved this week</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-200">{summary.improvedThisWeek}</p>
        </article>
        <article className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 shadow-lg shadow-slate-950/50">
          <p className="text-xs uppercase tracking-[0.12em] text-rose-300">Regressed this week</p>
          <p className="mt-2 text-2xl font-semibold text-rose-200">{summary.regressedThisWeek}</p>
        </article>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/90 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/50">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Watchlist trend domains</h2>
          <p className="mt-1 text-sm text-slate-400">
            Click a domain row to expand full timeline details and header-level changes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onExportCsv}
            disabled={domainRows.length === 0}
            aria-label="Export trend report as CSV"
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {csvState === "exported" ? "CSV downloaded" : csvState === "error" ? "CSV failed" : "Export CSV"}
          </button>
          <button
            type="button"
            onClick={() => void onExportPdf()}
            disabled={domainRows.length === 0 || pdfState === "generating"}
            aria-label="Export trend report as PDF"
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pdfState === "generating"
              ? "Preparing PDF..."
              : pdfState === "exported"
                ? "PDF downloaded"
                : pdfState === "error"
                  ? "PDF failed"
                  : "Export PDF"}
          </button>
        </div>
      </div>

      {domainRows.length === 0 ? (
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
          <p className="text-sm text-slate-300">
            No trend data yet. Save watchlist scans and refresh entries to populate this dashboard.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {domainRows.map((row) => {
            const isExpanded = expandedDomain === row.domain;
            const sparklineColor =
              row.trend7.direction === "up"
                ? "text-emerald-300"
                : row.trend7.direction === "down"
                  ? "text-rose-300"
                  : "text-slate-300";

            return (
              <li key={row.domain} className="rounded-xl border border-slate-800/90 bg-slate-900/70 shadow-lg shadow-slate-950/50">
                <button
                  type="button"
                  onClick={() => setExpandedDomain((current) => (current === row.domain ? null : row.domain))}
                  aria-expanded={isExpanded}
                  className="w-full rounded-xl p-4 text-left transition hover:bg-slate-900/90"
                >
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-100">{row.displayUrl}</p>
                      <p className="mt-1 text-xs text-slate-500">Last checked {formatDateTime(row.latestCheckedAt)}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <TrendIndicator label="7d" trend={row.trend7} />
                        <TrendIndicator label="30d" trend={row.trend30} />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="h-10 w-24 sm:w-32">
                        <TrendChart
                          points={row.points}
                          className={`h-10 w-full ${sparklineColor}`}
                          ariaLabel={`Grade history sparkline for ${row.domain}`}
                        />
                      </div>
                      <p className="grade-badge-in text-sm font-semibold text-sky-200">Grade {row.latestGrade}</p>
                    </div>

                    <div className="flex items-center justify-end text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1">
                        {isExpanded ? "Hide details" : "Show details"}
                      </span>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-800 px-4 pb-4 pt-3">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Full grade history timeline</p>
                      <TrendChart
                        points={row.points}
                        width={720}
                        height={180}
                        className={`mt-3 h-40 w-full ${sparklineColor}`}
                        ariaLabel={`Full grade timeline for ${row.domain}`}
                      />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/history/${encodeURIComponent(row.domain)}`}
                          className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-sky-300 transition hover:border-sky-500/60 hover:text-sky-200"
                        >
                          Open dedicated history page
                        </Link>
                        <span className="text-xs text-slate-500">{row.points.length} points retained (up to 30)</span>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Header change timeline</p>
                      {row.timeline.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-400">No scan snapshots available for header-level diffs yet.</p>
                      ) : (
                        <ol className="mt-2 space-y-2">
                          {row.timeline.map((entry) => (
                            <li
                              key={entry.id}
                              className="rounded-lg border border-slate-800/90 bg-slate-950/70 p-3 text-sm text-slate-300"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs text-slate-500">{formatDateTime(entry.checkedAt)}</p>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sky-200">Grade {entry.grade}</span>
                                  {entry.gradeDelta !== null ? (
                                    <span
                                      className={`rounded-md border px-2 py-0.5 text-xs ${
                                        entry.gradeDelta > 0
                                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                          : entry.gradeDelta < 0
                                            ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                                            : "border-slate-700 bg-slate-900/80 text-slate-300"
                                      }`}
                                    >
                                      {entry.gradeDelta > 0
                                        ? "Improved"
                                        : entry.gradeDelta < 0
                                          ? "Regressed"
                                          : "No grade change"}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              {entry.headerChanges.length > 0 ? (
                                <ul className="mt-2 space-y-1">
                                  {entry.headerChanges.map((change) => (
                                    <li key={`${entry.id}-${change.key}`} className="text-xs text-slate-300">
                                      <span className="font-medium text-slate-200">{change.label}</span>:{" "}
                                      <span className={statusTone(change.from)}>{change.from}</span>
                                      {" -> "}
                                      <span className={statusTone(change.to)}>{change.to}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-2 text-xs text-slate-500">No specific header status changes for this snapshot.</p>
                              )}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
