import { SiteNav } from "@/app/components/SiteNav";

function MetricCardSkeleton() {
  return (
    <article className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/50">
      <div className="skeleton-shimmer h-3 w-32 rounded" />
      <div className="skeleton-shimmer mt-3 h-8 w-24 rounded" />
      <div className="skeleton-shimmer mt-2 h-3 w-28 rounded" />
    </article>
  );
}

export default function PublicStatsLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />

      <section className="mb-6 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <div className="skeleton-shimmer h-3 w-32 rounded" />
        <div className="skeleton-shimmer mt-3 h-8 w-80 rounded" />
        <div className="skeleton-shimmer mt-3 h-4 w-2/3 rounded" />
      </section>

      <section className="space-y-6" aria-hidden="true">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
            <div className="flex items-center justify-between gap-3">
              <div className="skeleton-shimmer h-6 w-44 rounded" />
              <div className="skeleton-shimmer h-6 w-20 rounded-full" />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
              <div className="mx-auto h-40 w-40 rounded-full border border-slate-700/80 p-2">
                <div className="skeleton-shimmer h-full w-full rounded-full" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={`grade-legend-skeleton-${index}`} className="skeleton-shimmer h-5 w-full rounded" />
                ))}
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
            <div className="flex items-center justify-between gap-3">
              <div className="skeleton-shimmer h-6 w-56 rounded" />
              <div className="skeleton-shimmer h-6 w-20 rounded-full" />
            </div>
            <div className="mt-4 space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`missing-header-skeleton-${index}`}>
                  <div className="skeleton-shimmer h-4 w-full rounded" />
                  <div className="skeleton-shimmer mt-2 h-2 w-5/6 rounded-full" />
                </div>
              ))}
            </div>
          </article>
        </div>

        <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
          <div className="flex items-center justify-between gap-3">
            <div className="skeleton-shimmer h-6 w-48 rounded" />
            <div className="skeleton-shimmer h-6 w-36 rounded" />
          </div>
          <div className="skeleton-shimmer mt-4 h-56 w-full rounded-xl" />
        </article>

        <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-r from-sky-500/10 via-slate-900/60 to-cyan-500/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="skeleton-shimmer h-3 w-36 rounded" />
              <div className="skeleton-shimmer mt-2 h-7 w-56 rounded" />
            </div>
            <div className="skeleton-shimmer h-11 w-36 rounded-lg" />
          </div>
        </div>
      </section>
    </main>
  );
}
