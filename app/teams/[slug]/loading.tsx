import { SiteNav } from "@/app/components/SiteNav";

function TeamWatchlistSkeletonRow() {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <div className="skeleton-shimmer h-4 w-56 rounded" />
      <div className="skeleton-shimmer mt-2 h-3 w-44 rounded" />
      <div className="mt-3 flex gap-2">
        <div className="skeleton-shimmer h-7 w-20 rounded-md" />
        <div className="skeleton-shimmer h-7 w-20 rounded-md" />
        <div className="skeleton-shimmer h-7 w-20 rounded-md" />
      </div>
    </div>
  );
}

export default function TeamDashboardLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />
      <section className="mb-6 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <div className="skeleton-shimmer h-3 w-28 rounded" />
        <div className="skeleton-shimmer mt-3 h-8 w-2/3 rounded" />
        <div className="skeleton-shimmer mt-3 h-4 w-3/4 rounded" />
      </section>
      <section className="grid gap-6 lg:grid-cols-3" aria-hidden="true">
        <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div className="skeleton-shimmer h-6 w-40 rounded" />
            <div className="skeleton-shimmer h-7 w-24 rounded-md" />
          </div>
          <div className="mt-4 space-y-2">
            <TeamWatchlistSkeletonRow />
            <TeamWatchlistSkeletonRow />
            <TeamWatchlistSkeletonRow />
          </div>
        </article>
        <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
          <div className="skeleton-shimmer h-6 w-24 rounded" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`member-skeleton-${index}`} className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
                <div className="skeleton-shimmer h-4 w-36 rounded" />
                <div className="skeleton-shimmer mt-2 h-3 w-28 rounded" />
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
