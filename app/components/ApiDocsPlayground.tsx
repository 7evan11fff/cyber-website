"use client";

import { FormEvent, useMemo, useState } from "react";

type ViewMode = "pretty" | "raw";
type CopyState = "idle" | "copied" | "error";

type RateLimitInfo = {
  limit: string | null;
  remaining: string | null;
  reset: string | null;
};

function parseResetTime(resetEpochSeconds: string | null): string | null {
  if (!resetEpochSeconds) return null;
  const parsed = Number(resetEpochSeconds);
  if (!Number.isFinite(parsed)) return null;
  const resetDate = new Date(parsed * 1000);
  if (Number.isNaN(resetDate.getTime())) return null;
  return resetDate.toLocaleTimeString();
}

function normalizeErrorMessage(status: number, payload: unknown): string {
  const apiError =
    payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : null;
  const normalized = apiError?.toLowerCase() ?? "";

  if (status === 429) {
    return "Too many requests in a short time. Please wait a moment, then try again.";
  }

  if (status === 401 && normalized.includes("api key")) {
    return "API key not recognized. Verify your key and try again.";
  }

  if (
    normalized.includes("fetch failed") ||
    normalized.includes("enotfound") ||
    normalized.includes("eai_again") ||
    normalized.includes("econnrefused") ||
    normalized.includes("econnreset")
  ) {
    return "We couldn't reach that domain. Check the URL and confirm the site is online, then try again.";
  }

  if (apiError) {
    return apiError;
  }

  if (status >= 500) {
    return "The scan service is temporarily unavailable. Please try again shortly.";
  }

  return "Unable to run the check right now. Verify the URL and try again.";
}

export function ApiDocsPlayground() {
  const [targetUrl, setTargetUrl] = useState("https://example.com");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseBodyText, setResponseBodyText] = useState("");
  const [responsePayload, setResponsePayload] = useState<unknown>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("pretty");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [rateLimit, setRateLimit] = useState<RateLimitInfo>({
    limit: null,
    remaining: null,
    reset: null
  });
  const [lastStatusCode, setLastStatusCode] = useState<number | null>(null);

  const formattedResponse = useMemo(() => {
    if (!responseBodyText && responsePayload == null) {
      return "";
    }

    if (viewMode === "raw") {
      if (responseBodyText) return responseBodyText;
      return JSON.stringify(responsePayload);
    }

    if (responsePayload != null) {
      return JSON.stringify(responsePayload, null, 2);
    }
    return responseBodyText;
  }, [responseBodyText, responsePayload, viewMode]);

  const responseReady = formattedResponse.length > 0;
  const resetTimeText = parseResetTime(rateLimit.reset);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedUrl = targetUrl.trim();
    if (!normalizedUrl) {
      setError("Enter a URL to test, for example https://example.com.");
      setResponseBodyText("");
      setResponsePayload(null);
      setLastStatusCode(null);
      return;
    }

    setLoading(true);
    setError(null);
    setCopyState("idle");

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: normalizedUrl })
      });

      const bodyText = await response.text();
      let parsedPayload: unknown = null;
      if (bodyText) {
        try {
          parsedPayload = JSON.parse(bodyText) as unknown;
        } catch {
          parsedPayload = null;
        }
      }

      setResponseBodyText(bodyText);
      setResponsePayload(parsedPayload);
      setLastStatusCode(response.status);
      setRateLimit({
        limit: response.headers.get("X-RateLimit-Limit"),
        remaining: response.headers.get("X-RateLimit-Remaining"),
        reset: response.headers.get("X-RateLimit-Reset")
      });

      if (!response.ok) {
        setError(normalizeErrorMessage(response.status, parsedPayload));
      }
    } catch {
      setResponseBodyText("");
      setResponsePayload(null);
      setLastStatusCode(null);
      setRateLimit({
        limit: null,
        remaining: null,
        reset: null
      });
      setError("Network error while calling /api/check. Confirm your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function onCopyResponse() {
    if (!responseReady) return;
    try {
      await navigator.clipboard.writeText(formattedResponse);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    } finally {
      window.setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70">
      <h2 className="text-xl font-semibold text-slate-100">Live API Playground</h2>
      <p className="mt-2 text-sm text-slate-300">
        Try <code>/api/check</code> directly from this page. Enter a URL, run the request, and inspect the JSON output.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="api-playground-url" className="mb-1 block text-xs uppercase tracking-[0.14em] text-slate-400">
            Target URL
          </label>
          <input
            id="api-playground-url"
            type="text"
            value={targetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
            aria-label="URL to scan in API playground"
            placeholder="https://example.com"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            autoComplete="url"
            required
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            aria-label="Run API playground request"
            className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {loading ? "Running..." : "Run"}
          </button>
          <p className="text-xs text-slate-400" aria-live="polite">
            Press Enter to submit.
          </p>
        </div>
      </form>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      <div className="mt-4 rounded-xl border border-slate-800/90 bg-slate-950/60 p-3 text-xs text-slate-300">
        <p>
          Rate limit:{" "}
          <span className="font-semibold text-slate-100">{rateLimit.remaining ?? "--"}</span> remaining
          {rateLimit.limit ? ` of ${rateLimit.limit}` : ""}.
          {resetTimeText ? ` Resets around ${resetTimeText}.` : ""}
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-slate-800/90">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/90 px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("pretty")}
              aria-label="Switch to pretty JSON view"
              className={`rounded-md border px-2.5 py-1 text-xs uppercase tracking-[0.1em] transition ${
                viewMode === "pretty"
                  ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
                  : "border-slate-700 bg-slate-950/80 text-slate-300 hover:border-sky-500/60 hover:text-sky-200"
              }`}
            >
              Pretty JSON
            </button>
            <button
              type="button"
              onClick={() => setViewMode("raw")}
              aria-label="Switch to raw JSON view"
              className={`rounded-md border px-2.5 py-1 text-xs uppercase tracking-[0.1em] transition ${
                viewMode === "raw"
                  ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
                  : "border-slate-700 bg-slate-950/80 text-slate-300 hover:border-sky-500/60 hover:text-sky-200"
              }`}
            >
              Raw JSON
            </button>
          </div>
          <button
            type="button"
            onClick={onCopyResponse}
            disabled={!responseReady}
            aria-label="Copy API response to clipboard"
            className="rounded-md border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-xs uppercase tracking-[0.1em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy response"}
          </button>
        </div>

        <div className="p-3">
          <p className="mb-2 text-xs text-slate-500" aria-live="polite">
            Last status: {lastStatusCode ?? "--"}
          </p>
          <pre
            className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200"
            aria-label="API response output"
            aria-live="polite"
          >
            <code>{responseReady ? formattedResponse : "Run a request to see the live response payload."}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}
