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

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);

  const gradeColor = useMemo(() => {
    if (!report) return "text-slate-200";
    return gradeStyles[report.grade] ?? "text-slate-200";
  }, [report]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url })
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
            {loading ? "Checking..." : "Check"}
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        )}
      </section>

      {report && (
        <section className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Overall Grade</p>
            <p className={`mt-2 text-7xl font-bold ${gradeColor}`}>{report.grade}</p>
            <p className="mt-1 text-sm text-slate-300">
              Score: {report.score}/{report.results.length * 2}
            </p>
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
    </main>
  );
}
