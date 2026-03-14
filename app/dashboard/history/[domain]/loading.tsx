import { SiteNav } from "@/app/components/SiteNav";

function HistoryCardSkeleton() {
  return (
    <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
      <div className="flex items-center justify-between gap-3">
        <div className="skeleton-shimmer h-5 w-40 rounded" />
        <div className="skeleton-shimmer h-6 w-20 rounded-full" />
      </div>
      <div className="skeleton-shimmer mt-4 h-32 rounded-xl" />
    </article>
  );
}

export default function WatchlistHistoryLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />
      <section className="mb-6 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <div className="skeleton-shimmer h-3 w-36 rounded" />
        <div className="skeleton-shimmer mt-3 h-8 w-2/3 rounded" />
        <div className="skeleton-shimmer mt-3 h-4 w-1/2 rounded" />
      </section>
      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" aria-hidden="true">
        <HistoryCardSkeleton />
        <HistoryCardSkeleton />
      </section>
      <section className="mt-6 rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
        <div className="skeleton-shimmer h-5 w-36 rounded" />
        <div className="skeleton-shimmer mt-4 h-48 rounded-xl" />
      </section>
    </main>
  );
}
