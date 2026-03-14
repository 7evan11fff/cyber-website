import { SiteNav } from "@/app/components/SiteNav";

function BlogCardSkeleton() {
  return (
    <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
      <div className="flex items-center gap-2">
        <div className="skeleton-shimmer h-3 w-24 rounded" />
        <div className="skeleton-shimmer h-3 w-14 rounded" />
      </div>
      <div className="skeleton-shimmer mt-3 h-7 w-2/3 rounded" />
      <div className="mt-4 space-y-2">
        <div className="skeleton-shimmer h-4 w-full rounded" />
        <div className="skeleton-shimmer h-4 w-5/6 rounded" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="skeleton-shimmer h-5 w-16 rounded-md" />
        <div className="skeleton-shimmer h-5 w-20 rounded-md" />
        <div className="skeleton-shimmer h-5 w-12 rounded-md" />
      </div>
      <div className="skeleton-shimmer mt-5 h-9 w-28 rounded-lg" />
    </article>
  );
}

export default function BlogLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />
      <section className="mb-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <div className="skeleton-shimmer h-3 w-32 rounded" />
        <div className="skeleton-shimmer mt-3 h-10 w-3/5 rounded" />
        <div className="mt-3 space-y-2">
          <div className="skeleton-shimmer h-4 w-full rounded" />
          <div className="skeleton-shimmer h-4 w-3/4 rounded" />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70">
        <BlogCardSkeleton />
        <BlogCardSkeleton />
        <BlogCardSkeleton />
      </section>
    </main>
  );
}
