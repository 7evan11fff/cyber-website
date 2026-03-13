"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { HeaderResult } from "@/lib/securityHeaders";

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

type HistoryEntry = {
  id: string;
  url: string;
  grade: string;
  checkedAt: string;
};

type HeaderDifference = {
  key: string;
  label: string;
  messages: string[];
};

type ScanMode = "single" | "compare";

const SAMPLE_SITES = ["google.com", "github.com", "facebook.com"];
const HISTORY_STORAGE_KEY = "security-header-checker:scan-history";
const MAX_HISTORY_ITEMS = 10;

const statusStyles: Record<HeaderResult["status"], string> = {
  good: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30",
  weak: "bg-amber-500/20 text-amber-300 ring-amber-500/30",
  missing: "bg-rose-500/20 text-rose-300 ring-rose-500/30"
};

const gradeStyles: Record<string, string> = {
  A: "text-emerald-300",
  B: "text-lime-300",
  C: "text-amber-300",
  D: "text-orange-300",
  F: "text-rose-300"
};

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<HistoryEntry>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.url === "string" &&
    typeof candidate.grade === "string" &&
    typeof candidate.checkedAt === "string"
  );
}

function gradeColor(grade: string) {
  return gradeStyles[grade] ?? "text-slate-200";
}

function formatReportForClipboard(report: ReportResponse): string {
  const checkedAt = new Date(report.checkedAt).toLocaleString();
  const lines = [
    "Security Header Checker Report",
    "==============================",
    `Checked URL: ${report.checkedUrl}`,
    `Final URL: ${report.finalUrl}`,
    `Status Code: ${report.statusCode}`,
    `Grade: ${report.grade}`,
    `Score: ${report.score}/${report.results.length * 2}`,
    `Checked At: ${checkedAt}`,
    "",
    "Header Details",
    "--------------"
  ];

  for (const result of report.results) {
    lines.push(`${result.label}: ${result.status.toUpperCase()}`);
    lines.push(`  Value: ${result.value ?? "Missing"}`);
    lines.push(`  Why it matters: ${result.whyItMatters}`);
    lines.push(`  Recommendation: ${result.guidance}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

function LoadingSkeleton() {
  return (
    <section className="mt-6 grid animate-pulse gap-6 lg:grid-cols-[280px_1fr]">
      <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="h-3 w-24 rounded bg-slate-700/70" />
        <div className="mt-4 h-16 w-20 rounded bg-slate-700/70" />
        <div className="mt-3 h-3 w-36 rounded bg-slate-700/70" />
        <div className="mt-6 space-y-2">
          <div className="h-3 rounded bg-slate-800/80" />
          <div className="h-3 rounded bg-slate-800/80" />
          <div className="h-3 rounded bg-slate-800/80" />
        </div>
      </article>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <article
            key={index}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/50"
          >
            <div className="h-5 w-2/3 rounded bg-slate-700/70" />
            <div className="mt-3 h-3 rounded bg-slate-800/80" />
            <div className="mt-2 h-3 w-11/12 rounded bg-slate-800/80" />
            <div className="mt-5 h-3 rounded bg-slate-800/80" />
            <div className="mt-2 h-3 w-5/6 rounded bg-slate-800/80" />
          </article>
        ))}
      </div>
    </section>
  );
}

function HeaderCard({
  header,
  highlighted = false
}: {
  header: HeaderResult;
  highlighted?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border p-5 shadow-lg ${
        highlighted
          ? "border-sky-500/60 bg-sky-500/10 shadow-sky-950/40"
          : "border-slate-800 bg-slate-900/60 shadow-slate-950/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-100">{header.label}</h2>
        <div className="flex items-center gap-2">
          {highlighted && (
            <span className="rounded-full bg-sky-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-200 ring-1 ring-sky-500/40">
              Diff
            </span>
          )}
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ring-1 ${statusStyles[header.status]}`}
          >
            {header.status}
          </span>
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-300">{header.whyItMatters}</p>
      <p className="mt-3 text-sm text-slate-400">
        <span className="text-slate-500">Current value:</span>{" "}
        {header.value ? (
          <code className="break-all rounded bg-slate-950 px-1.5 py-0.5 text-xs text-slate-200">
            {header.value}
          </code>
        ) : (
          <span className="text-rose-200">Missing</span>
        )}
      </p>
      <p className="mt-3 text-sm text-slate-300">
        <span className="font-medium text-slate-200">Recommendation:</span> {header.guidance}
      </p>
    </article>
  );
}

function SiteSummary({ title, report }: { title: string; report: ReportResponse }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{title}</p>
          <p className="mt-2 text-sm text-slate-300">{report.checkedUrl}</p>
        </div>
        <p className={`text-5xl font-bold ${gradeColor(report.grade)}`}>{report.grade}</p>
      </div>
      <p className="mt-2 text-sm text-slate-300">
        Score: {report.score}/{report.results.length * 2}
      </p>
      <div className="mt-4 space-y-1 text-sm text-slate-300">
        <p>
          <span className="text-slate-500">Final URL:</span> {report.finalUrl}
        </p>
        <p>
          <span className="text-slate-500">Status:</span> {report.statusCode}
        </p>
        <p>
          <span className="text-slate-500">Time:</span> {new Date(report.checkedAt).toLocaleString()}
        </p>
      </div>
    </article>
  );
}

export default function Home() {
  const [mode, setMode] = useState<ScanMode>("single");
  const [url, setUrl] = useState("");
  const [compareUrlA, setCompareUrlA] = useState("");
  const [compareUrlB, setCompareUrlB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [comparison, setComparison] = useState<ComparisonReport | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [scanHistory, setScanHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(true);

  const singleGradeColor = useMemo(() => {
    if (!report) return "text-slate-200";
    return gradeColor(report.grade);
  }, [report]);

  const comparisonDifferences = useMemo<HeaderDifference[]>(() => {
    if (!comparison) return [];

    const mapSiteB = new Map(comparison.siteB.results.map((header) => [header.key, header]));
    const differences: HeaderDifference[] = [];

    for (const siteAHeader of comparison.siteA.results) {
      const siteBHeader = mapSiteB.get(siteAHeader.key);
      if (!siteBHeader) continue;

      const messages: string[] = [];

      if (siteAHeader.present !== siteBHeader.present) {
        if (siteAHeader.present) {
          messages.push(`Site A includes ${siteAHeader.label}, but Site B is missing it.`);
        } else {
          messages.push(`Site B includes ${siteAHeader.label}, but Site A is missing it.`);
        }
      } else if (siteAHeader.status !== siteBHeader.status) {
        messages.push(
          `Coverage differs: Site A is ${siteAHeader.status}, Site B is ${siteBHeader.status}.`
        );
      }

      const siteAValue = siteAHeader.value?.trim();
      const siteBValue = siteBHeader.value?.trim();
      if (siteAValue && siteBValue && siteAValue !== siteBValue) {
        messages.push("Header values are different between both sites.");
      }

      if (messages.length > 0) {
        differences.push({
          key: siteAHeader.key,
          label: siteAHeader.label,
          messages
        });
      }
    }

    return differences;
  }, [comparison]);

  const differingHeaderKeys = useMemo(() => {
    return new Set(comparisonDifferences.map((difference) => difference.key));
  }, [comparisonDifferences]);

  useEffect(() => {
    try {
      const rawHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!rawHistory) return;
      const parsed = JSON.parse(rawHistory);
      if (!Array.isArray(parsed)) return;
      const loadedEntries = parsed.filter(isHistoryEntry).slice(0, MAX_HISTORY_ITEMS);
      setScanHistory(loadedEntries);
    } catch {
      setScanHistory([]);
    }
  }, []);

  function addToHistory(nextReport: ReportResponse) {
    const nextEntry: HistoryEntry = {
      id: `${nextReport.checkedAt}-${nextReport.checkedUrl}`,
      url: nextReport.checkedUrl,
      grade: nextReport.grade,
      checkedAt: nextReport.checkedAt
    };

    setScanHistory((previous) => {
      const updated = [nextEntry, ...previous].slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    setScanHistory([]);
  }

  async function requestReport(targetUrl: string): Promise<ReportResponse> {
    const sanitized = targetUrl.trim();
    if (!sanitized) {
      throw new Error("Please enter a URL.");
    }

    const response = await fetch("/api/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url: sanitized })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error ?? "Unable to check headers.");
    }

    return payload as ReportResponse;
  }

  async function runSingleCheck(targetUrl: string) {
    setLoading(true);
    setError(null);
    setReport(null);
    setComparison(null);
    setCopyState("idle");

    try {
      const payload = await requestReport(targetUrl);
      setReport(payload);
      addToHistory(payload);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unexpected error.";
      setReport(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function runComparisonCheck(siteAUrl: string, siteBUrl: string) {
    if (!siteAUrl.trim() || !siteBUrl.trim()) {
      setError("Please enter both URLs to compare.");
      return;
    }

    setLoading(true);
    setError(null);
    setReport(null);
    setComparison(null);
    setCopyState("idle");

    try {
      const [siteA, siteB] = await Promise.all([requestReport(siteAUrl), requestReport(siteBUrl)]);
      setComparison({ siteA, siteB });
      addToHistory(siteA);
      addToHistory(siteB);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unexpected error.";
      setComparison(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function onSingleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSingleCheck(url);
  }

  function onCompareSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runComparisonCheck(compareUrlA, compareUrlB);
  }

  function onSampleClick(sampleUrl: string) {
    setMode("single");
    setUrl(sampleUrl);
    void runSingleCheck(sampleUrl);
  }

  function onHistoryEntryClick(entryUrl: string) {
    setMode("single");
    setUrl(entryUrl);
    void runSingleCheck(entryUrl);
  }

  async function onCopyReport() {
    if (!report) return;

    try {
      await navigator.clipboard.writeText(formatReportForClipboard(report));
      setCopyState("copied");
    } catch {
      setCopyState("error");
    } finally {
      window.setTimeout(() => setCopyState("idle"), 2500);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <p className="text-sm uppercase tracking-[0.2em] text-sky-300">Security Header Checker</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100 sm:text-4xl">
          Instant Website Security Report Card
        </h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          Scan one site for a detailed report, or compare two sites side by side to spot header gaps.
        </p>

        <div className="mt-6 inline-flex rounded-xl border border-slate-700 bg-slate-950/80 p-1">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              mode === "single"
                ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-950/70"
                : "text-slate-300 hover:text-sky-200"
            }`}
          >
            Single Scan
          </button>
          <button
            type="button"
            onClick={() => setMode("compare")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              mode === "compare"
                ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-950/70"
                : "text-slate-300 hover:text-sky-200"
            }`}
          >
            Compare
          </button>
        </div>

        {mode === "single" ? (
          <>
            <form onSubmit={onSingleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="example.com or https://example.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-sky-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {loading ? "Scanning..." : "Check"}
              </button>
            </form>

            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Try sample sites</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SAMPLE_SITES.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => onSampleClick(sample)}
                    disabled={loading}
                    className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-sm text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <form onSubmit={onCompareSubmit} className="mt-6">
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="text"
                value={compareUrlA}
                onChange={(event) => setCompareUrlA(event.target.value)}
                placeholder="Site A (example.com)"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                required
              />
              <input
                type="text"
                value={compareUrlB}
                onChange={(event) => setCompareUrlB(event.target.value)}
                placeholder="Site B (example.org)"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-3 rounded-xl bg-sky-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {loading ? "Comparing..." : "Compare Headers"}
            </button>
          </form>
        )}

        <section className="mt-5 rounded-xl border border-slate-800/90 bg-slate-950/60">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              className="text-sm font-medium text-slate-200 transition hover:text-sky-200"
            >
              Recent Scans ({scanHistory.length}) {historyOpen ? "−" : "+"}
            </button>
            <button
              type="button"
              onClick={clearHistory}
              disabled={scanHistory.length === 0}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear history
            </button>
          </div>
          {historyOpen && (
            <div className="border-t border-slate-800/90 px-4 py-3">
              {scanHistory.length === 0 ? (
                <p className="text-sm text-slate-400">No scans yet. Run a check to build your history.</p>
              ) : (
                <ul className="space-y-2">
                  {scanHistory.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => onHistoryEntryClick(entry.url)}
                        disabled={loading}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-left transition hover:border-sky-500/60 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-100">{entry.url}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(entry.checkedAt).toLocaleString()}
                          </p>
                        </div>
                        <span className={`text-lg font-semibold ${gradeColor(entry.grade)}`}>
                          {entry.grade}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {error && (
          <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        )}
      </section>

      {loading && <LoadingSkeleton />}

      {!loading && report && (
        <section className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Overall Grade</p>
            <p className={`mt-2 text-7xl font-bold ${singleGradeColor}`}>{report.grade}</p>
            <p className="mt-1 text-sm text-slate-300">
              Score: {report.score}/{report.results.length * 2}
            </p>
            <button
              type="button"
              onClick={onCopyReport}
              className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
            >
              {copyState === "copied" ? "Copied report" : "Copy Report"}
            </button>
            {copyState === "error" && (
              <p className="mt-2 text-xs text-rose-300">
                Clipboard unavailable. Please copy manually.
              </p>
            )}
            <div className="mt-4 space-y-1 text-sm text-slate-300">
              <p>
                <span className="text-slate-500">Checked URL:</span> {report.checkedUrl}
              </p>
              <p>
                <span className="text-slate-500">Final URL:</span> {report.finalUrl}
              </p>
              <p>
                <span className="text-slate-500">Status:</span> {report.statusCode}
              </p>
              <p>
                <span className="text-slate-500">Time:</span> {new Date(report.checkedAt).toLocaleString()}
              </p>
            </div>
          </article>

          <div className="grid gap-4 sm:grid-cols-2">
            {report.results.map((header) => (
              <HeaderCard key={header.key} header={header} />
            ))}
          </div>
        </section>
      )}

      {!loading && comparison && (
        <section className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <SiteSummary title="Site A" report={comparison.siteA} />
            <SiteSummary title="Site B" report={comparison.siteB} />
          </div>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/50">
            <h2 className="text-lg font-semibold text-slate-100">Header Differences</h2>
            <p className="mt-1 text-sm text-slate-400">
              Highlighted rows call out mismatches in presence, strength, or values.
            </p>
            {comparisonDifferences.length === 0 ? (
              <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                Nice work — both sites have matching header coverage across all checked categories.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {comparisonDifferences.map((difference) => (
                  <li
                    key={difference.key}
                    className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-sky-100">{difference.label}</p>
                    <ul className="mt-1 space-y-1 text-sm text-sky-200/90">
                      {difference.messages.map((message) => (
                        <li key={message}>• {message}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <div className="grid gap-6 xl:grid-cols-2">
            <section>
              <h3 className="mb-3 text-sm uppercase tracking-[0.2em] text-slate-400">Site A Headers</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {comparison.siteA.results.map((header) => (
                  <HeaderCard
                    key={`a-${header.key}`}
                    header={header}
                    highlighted={differingHeaderKeys.has(header.key)}
                  />
                ))}
              </div>
            </section>
            <section>
              <h3 className="mb-3 text-sm uppercase tracking-[0.2em] text-slate-400">Site B Headers</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {comparison.siteB.results.map((header) => (
                  <HeaderCard
                    key={`b-${header.key}`}
                    header={header}
                    highlighted={differingHeaderKeys.has(header.key)}
                  />
                ))}
              </div>
            </section>
          </div>
        </section>
      )}

      <footer className="mt-10 border-t border-slate-800/80 pt-6 text-sm text-slate-400">
        <p>
          Built by Evan Klein ·{" "}
          <a
            className="text-sky-300 transition hover:text-sky-200"
            href="https://github.com/7evan11fff"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>{" "}
          ·{" "}
          <a
            className="text-sky-300 transition hover:text-sky-200"
            href="https://x.com"
            target="_blank"
            rel="noreferrer"
          >
            Twitter
          </a>
        </p>
      </footer>
    </main>
  );
}
