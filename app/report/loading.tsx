import { SiteNav } from "@/app/components/SiteNav";

function HeaderCardSkeleton() {
  return (
    <article className="rounded-2xl border border-slate-800/90 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="skeleton-shimmer h-5 w-40 rounded" />
          <div className="skeleton-shimmer mt-3 h-4 w-full rounded" />
          <div className="skeleton-shimmer mt-2 h-4 w-4/5 rounded" />
        </div>
        <div className="skeleton-shimmer h-6 w-16 rounded-full" />
      </div>
    </article>
  );
}

export default function ReportLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />

      <section className="mb-6 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <div className="skeleton-shimmer h-3 w-28 rounded" />
        <div className="skeleton-shimmer mt-3 h-8 w-2/3 rounded" />
        <div className="skeleton-shimmer mt-3 h-4 w-3/5 rounded" />
      </section>

      <section className="mb-5 rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="skeleton-shimmer h-3 w-24 rounded" />
            <div className="skeleton-shimmer mt-3 h-4 w-full rounded" />
            <div className="skeleton-shimmer mt-2 h-4 w-4/5 rounded" />
          </div>
          <div className="text-right">
            <div className="skeleton-shimmer h-12 w-16 rounded" />
            <div className="skeleton-shimmer mt-2 h-4 w-20 rounded" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2" aria-hidden="true">
        <HeaderCardSkeleton />
        <HeaderCardSkeleton />
        <HeaderCardSkeleton />
        <HeaderCardSkeleton />
      </section>
    </main>
  );
}
