import { SiteNav } from "@/app/components/SiteNav";

function ComparisonCardSkeleton() {
  return (
    <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
      <div className="skeleton-shimmer h-3 w-16 rounded" />
      <div className="skeleton-shimmer mt-3 h-4 w-11/12 rounded" />
      <div className="skeleton-shimmer mt-4 h-10 w-14 rounded" />
      <div className="skeleton-shimmer mt-2 h-4 w-28 rounded" />
    </article>
  );
}

export default function CompareLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />
      <section className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <div className="skeleton-shimmer h-3 w-20 rounded" />
        <div className="skeleton-shimmer mt-3 h-8 w-1/2 rounded" />
        <div className="skeleton-shimmer mt-3 h-4 w-3/4 rounded" />
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-2" aria-hidden="true">
        <ComparisonCardSkeleton />
        <ComparisonCardSkeleton />
      </section>
      <section className="mt-5 rounded-xl border border-slate-800/90 bg-slate-900/70 p-4" aria-hidden="true">
        <div className="skeleton-shimmer h-4 w-44 rounded" />
        <div className="skeleton-shimmer mt-3 h-44 rounded-xl" />
      </section>
    </main>
  );
}
