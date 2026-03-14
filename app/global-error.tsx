"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global app error:", error);
  }, [error]);

  const incidentId = error.digest ?? "unavailable";

  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-start justify-center bg-slate-950 px-4 py-12 text-slate-100 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-300">
            Critical application error
          </p>
          <h1 className="mt-3 text-3xl font-semibold">We hit an unrecoverable issue.</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            Refresh the page to retry. If this keeps happening, return to the scanner while we investigate.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Incident ID: <code className="rounded bg-slate-900 px-1.5 py-0.5 text-slate-300">{incidentId}</code>
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-100 transition hover:border-sky-500/60 hover:text-sky-200"
            >
              Retry app
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-100 transition hover:border-sky-500/60 hover:text-sky-200"
            >
              Reload page
            </button>
            <Link
              href="/"
              className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-100 transition hover:border-sky-500/60 hover:text-sky-200"
            >
              Go to scanner
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
