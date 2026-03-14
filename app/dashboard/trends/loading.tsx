import { SiteNav } from "@/app/components/SiteNav";

function SummaryCardSkeleton() {
  return (
    <article className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/50">
      <div className="skeleton-shimmer h-3 w-28 rounded" />
      <div className="skeleton-shimmer mt-3 h-8 w-20 rounded" />
    </article>
  );
}

function TrendDomainRowSkeleton() {
  return (
    <li className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/50">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
        <div>
          <div className="skeleton-shimmer h-4 w-56 rounded" />
          <div className="skeleton-shimmer mt-2 h-3 w-40 rounded" />
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="skeleton-shimmer h-6 w-44 rounded-md" />
            <div className="skeleton-shimmer h-6 w-44 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="skeleton-shimmer h-10 w-32 rounded" />
          <div className="skeleton-shimmer h-5 w-14 rounded-full" />
        </div>
        <div className="flex items-center justify-end">
          <div className="skeleton-shimmer h-6 w-24 rounded-md" />
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-slate-800/90 bg-slate-950/60 p-3">
        <div className="skeleton-shimmer h-3 w-40 rounded" />
        <div className="mt-3 grid h-28 grid-cols-10 items-end gap-1">
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              key={`trend-point-skeleton-${index}`}
              className="skeleton-shimmer rounded"
              style={{ height: `${18 + ((index * 9) % 70)}%` }}
            />
          ))}
        </div>
      </div>
    </li>
  );
}

export default function DashboardTrendsLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />

      <section className="mb-6 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <div className="skeleton-shimmer h-3 w-32 rounded" />
        <div className="skeleton-shimmer mt-3 h-8 w-72 rounded" />
        <div className="skeleton-shimmer mt-3 h-4 w-64 rounded" />
      </section>

      <section className="space-y-6" aria-hidden="true">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCardSkeleton />
          <SummaryCardSkeleton />
          <SummaryCardSkeleton />
          <SummaryCardSkeleton />
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="skeleton-shimmer h-6 w-52 rounded" />
              <div className="skeleton-shimmer mt-2 h-4 w-72 rounded" />
            </div>
            <div className="flex gap-2">
              <div className="skeleton-shimmer h-8 w-24 rounded-lg" />
              <div className="skeleton-shimmer h-8 w-24 rounded-lg" />
            </div>
          </div>
        </div>

        <ul className="space-y-3">
          <TrendDomainRowSkeleton />
          <TrendDomainRowSkeleton />
          <TrendDomainRowSkeleton />
        </ul>
      </section>
    </main>
  );
}
