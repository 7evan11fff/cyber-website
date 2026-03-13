"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { useToast } from "@/app/components/ToastProvider";
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

const MAX_BULK_URLS = 10;
const SHARE_QUERY_PARAM = "share";

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

function toBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeSharePayload(payload: SharePayload) {
  return toBase64Url(JSON.stringify(payload));
}

function buildFullReportHref(report: ReportResponse): string {
  const payload: SharePayload = {
    version: 1,
    mode: "single",
    report
  };
  const token = encodeSharePayload(payload);
  const params = new URLSearchParams({ [SHARE_QUERY_PARAM]: token });
  return `/?${params.toString()}`;
}

function missingHeaderLabels(report: ReportResponse): string[] {
  return report.results.filter((entry) => entry.status === "missing").map((entry) => entry.label);
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
  const { status: sessionStatus } = useSession();
  const [bulkUrlsInput, setBulkUrlsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkScanResult[]>([]);

  const isAuthenticated = sessionStatus === "authenticated";
  const enteredUrlCount = useMemo(() => {
    return bulkUrlsInput
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean).length;
  }, [bulkUrlsInput]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const targets = bulkUrlsInput
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (targets.length === 0) {
      setError("Please enter at least one URL.");
      setResults([]);
      return;
    }

    if (targets.length > MAX_BULK_URLS) {
      setError(`Bulk scanning supports up to ${MAX_BULK_URLS} URLs per run.`);
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const settled = await Promise.allSettled(targets.map((target) => requestReport(target)));
      const nextResults = settled.map((result, index): BulkScanResult => {
        if (result.status === "fulfilled") {
          const report = result.value;
          return {
            inputUrl: targets[index],
            report,
            missingHeaders: missingHeaderLabels(report),
            reportHref: buildFullReportHref(report),
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

      const failedCount = nextResults.filter((entry) => entry.error).length;
      setResults(nextResults);

      if (failedCount > 0) {
        const message = `${failedCount} of ${nextResults.length} scans failed. Review the table for details.`;
        setError(message);
        notify({ tone: "error", message });
      } else {
        notify({ tone: "success", message: `Scanned ${nextResults.length} URL${nextResults.length === 1 ? "" : "s"}.` });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />

      <section className="mb-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Bulk scan mode</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100 sm:text-4xl">Scan up to 10 URLs at once</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Paste one URL per line to run multiple scans together. Compare grades, identify missing headers quickly, and
          open a full report for any row.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
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
            <p className="text-xs text-slate-500">{isAuthenticated ? "Signed in: higher per-minute limit." : "Not signed in: standard per-minute limit."}</p>
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

        {results.length > 0 && (
          <section className="mt-6 overflow-x-auto rounded-xl border border-slate-800/90">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900/70 text-xs uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">URL</th>
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3">Missing headers</th>
                  <th className="px-4 py-3">Full report</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((entry, index) => (
                  <tr key={`${entry.inputUrl}-${index}`} className="border-t border-slate-800/70">
                    <td className="px-4 py-3 align-top text-slate-200">
                      <p className="max-w-[320px] break-all">{entry.inputUrl}</p>
                      {entry.report && <p className="mt-1 max-w-[320px] break-all text-xs text-slate-500">{entry.report.finalUrl}</p>}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {entry.report ? (
                        <span className={`text-lg font-semibold ${gradeColor(entry.report.grade)}`}>{entry.report.grade}</span>
                      ) : (
                        <span className="text-lg font-semibold text-rose-300">--</span>
                      )}
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
                    <td className="px-4 py-3 align-top">
                      {entry.reportHref ? (
                        <Link
                          href={entry.reportHref}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-300 transition hover:text-sky-200"
                        >
                          Open full report
                        </Link>
                      ) : (
                        <span className="text-slate-500">Unavailable</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-300">{entry.error ?? "OK"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </section>

      <SiteFooter className="mt-10" />
    </main>
  );
}
