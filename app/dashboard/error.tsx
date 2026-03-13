"use client";

export default function DashboardError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5">
      <h2 className="text-lg font-semibold text-rose-100">Could not load your dashboard data</h2>
      <p className="mt-2 text-sm text-rose-200/90">
        Try reloading this section. If it keeps failing, sign out and sign back in.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg border border-rose-300/50 bg-rose-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-100 transition hover:bg-rose-500/25"
      >
        Retry dashboard
      </button>
    </section>
  );
}
