"use client";

import { FormEvent, useMemo, useState } from "react";
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

const SAMPLE_SITES = ["google.com", "github.com", "facebook.com"];

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

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const gradeColor = useMemo(() => {
    if (!report) return "text-slate-200";
    return gradeStyles[report.grade] ?? "text-slate-200";
  }, [report]);

  async function runCheck(targetUrl: string) {
    const sanitized = targetUrl.trim();
    if (!sanitized) {
      setError("Please enter a URL.");
      return;
    }

    setLoading(true);
    setError(null);
    setReport(null);
    setCopyState("idle");

    try {
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

      setReport(payload as ReportResponse);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unexpected error.";
      setReport(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runCheck(url);
  }

  function onSampleClick(sampleUrl: string) {
    setUrl(sampleUrl);
    void runCheck(sampleUrl);
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
          Enter any URL to inspect key HTTP security headers and get a fast, color-coded grade.
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
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
            <p className={`mt-2 text-7xl font-bold ${gradeColor}`}>{report.grade}</p>
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
                <span className="text-slate-500">Time:</span>{" "}
                {new Date(report.checkedAt).toLocaleString()}
              </p>
            </div>
          </article>

          <div className="grid gap-4 sm:grid-cols-2">
            {report.results.map((header) => (
              <article
                key={header.key}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-slate-100">{header.label}</h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ring-1 ${statusStyles[header.status]}`}
                  >
                    {header.status}
                  </span>
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
                  <span className="font-medium text-slate-200">Recommendation:</span>{" "}
                  {header.guidance}
                </p>
              </article>
            ))}
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
