"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function SettingsError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Settings route error:", error);
  }, [error]);

  return (
    <section className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5">
      <h2 className="text-lg font-semibold text-rose-100">Could not load your settings</h2>
      <p className="mt-2 text-sm text-rose-200/90">
        We could not fetch your account preferences. Retry now or refresh the page.
      </p>
      <p className="mt-2 text-xs text-rose-100/80">
        Incident ID: <code className="rounded bg-rose-950/50 px-1.5 py-0.5">{error.digest ?? "unavailable"}</code>
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg border border-rose-300/50 bg-rose-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-100 transition hover:bg-rose-500/25"
      >
        Retry settings
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-rose-300/50 bg-rose-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-100 transition hover:bg-rose-500/25"
        >
          Reload page
        </button>
        <Link
          href="/"
          className="rounded-lg border border-rose-300/50 bg-rose-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-100 transition hover:bg-rose-500/25"
        >
          Back to scanner
        </Link>
      </div>
    </section>
  );
}
