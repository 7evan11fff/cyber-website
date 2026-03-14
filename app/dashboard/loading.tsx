import { SiteNav } from "@/app/components/SiteNav";

function WatchlistRowSkeleton() {
  return (
    <li className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="skeleton-shimmer h-4 w-52 rounded" />
          <div className="skeleton-shimmer mt-2 h-3 w-40 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="skeleton-shimmer h-9 w-24 rounded" />
          <div className="skeleton-shimmer h-5 w-16 rounded-full" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="skeleton-shimmer h-6 w-20 rounded-md" />
        <div className="skeleton-shimmer h-4 w-24 rounded" />
        <div className="skeleton-shimmer h-6 w-28 rounded-md" />
      </div>
    </li>
  );
}

function WatchlistPanelSkeleton() {
  return (
    <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
      <div className="flex items-center justify-between gap-3">
        <div className="skeleton-shimmer h-6 w-36 rounded" />
        <div className="skeleton-shimmer h-6 w-16 rounded-full" />
      </div>
      <ul className="mt-4 space-y-2">
        <WatchlistRowSkeleton />
        <WatchlistRowSkeleton />
        <WatchlistRowSkeleton />
      </ul>
      <div className="mt-4 rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
        <div className="skeleton-shimmer h-4 w-48 rounded" />
        <div className="skeleton-shimmer mt-2 h-3 w-64 rounded" />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="skeleton-shimmer h-9 rounded-lg" />
          <div className="skeleton-shimmer h-9 rounded-lg" />
        </div>
      </div>
    </article>
  );
}

function ScanHistorySkeleton() {
  return (
    <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
      <div className="flex items-center justify-between gap-3">
        <div className="skeleton-shimmer h-6 w-32 rounded" />
        <div className="skeleton-shimmer h-6 w-20 rounded-full" />
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`scan-history-skeleton-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="skeleton-shimmer h-4 w-56 rounded" />
            <div className="skeleton-shimmer mt-2 h-3 w-36 rounded" />
          </div>
        ))}
      </div>
    </article>
  );
}

function TrendChartCardSkeleton() {
  return (
    <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
      <div className="flex items-center justify-between gap-3">
        <div className="skeleton-shimmer h-6 w-52 rounded" />
        <div className="skeleton-shimmer h-6 w-24 rounded-full" />
      </div>
      <div className="mt-4 rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
        <div className="skeleton-shimmer h-4 w-40 rounded" />
        <div className="mt-4 grid h-24 grid-cols-7 items-end gap-1">
          {Array.from({ length: 7 }).map((_, index) => (
            <div
              key={`trend-bar-skeleton-${index}`}
              className="skeleton-shimmer rounded"
              style={{ height: `${30 + index * 8}%` }}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

export default function DashboardLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />
      <section className="mb-6 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <div className="skeleton-shimmer h-3 w-24 rounded" />
        <div className="skeleton-shimmer mt-3 h-8 w-2/3 rounded" />
        <div className="skeleton-shimmer mt-3 h-4 w-1/2 rounded" />
      </section>
      <section className="grid gap-6 lg:grid-cols-2" aria-hidden="true">
        <WatchlistPanelSkeleton />
        <ScanHistorySkeleton />
        <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
          <div className="skeleton-shimmer h-6 w-32 rounded" />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="skeleton-shimmer h-10 rounded-lg" />
            <div className="skeleton-shimmer h-10 rounded-lg" />
            <div className="skeleton-shimmer h-10 rounded-lg" />
          </div>
        </article>
        <TrendChartCardSkeleton />
        <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div className="skeleton-shimmer h-6 w-64 rounded" />
            <div className="skeleton-shimmer h-6 w-20 rounded-full" />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`public-scan-skeleton-${index}`}
                className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
              >
                <div className="skeleton-shimmer h-4 w-40 rounded" />
                <div className="skeleton-shimmer mt-2 h-3 w-32 rounded" />
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
