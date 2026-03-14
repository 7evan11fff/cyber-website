import { SiteNav } from "@/app/components/SiteNav";

function BulkRowSkeleton() {
  return (
    <div className="rounded-lg border border-slate-800/90 bg-slate-950/60 p-3">
      <div className="skeleton-shimmer h-4 w-10/12 rounded" />
      <div className="skeleton-shimmer mt-2 h-3 w-2/3 rounded" />
    </div>
  );
}

export default function BulkLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />
      <section className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <div className="skeleton-shimmer h-3 w-20 rounded" />
        <div className="skeleton-shimmer mt-3 h-8 w-2/3 rounded" />
        <div className="skeleton-shimmer mt-3 h-4 w-3/4 rounded" />
      </section>
      <section className="mt-6 rounded-xl border border-slate-800/90 bg-slate-900/70 p-4" aria-hidden="true">
        <div className="skeleton-shimmer h-5 w-44 rounded" />
        <div className="mt-4 space-y-2">
          <BulkRowSkeleton />
          <BulkRowSkeleton />
          <BulkRowSkeleton />
        </div>
      </section>
    </main>
  );
}
