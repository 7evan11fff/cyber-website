"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error("Global app error:", error);
  }, [error]);

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
          <div className="mt-6">
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
