"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App route error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-start justify-center px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-300">500 · Unexpected error</p>
      <h1 className="mt-3 text-3xl font-semibold text-slate-100">Something went wrong while loading this page.</h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-300">
        Try again in a moment. If the issue persists, return to the scanner and retry your action.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
        >
          Back to scanner
        </Link>
      </div>
    </main>
  );
}
