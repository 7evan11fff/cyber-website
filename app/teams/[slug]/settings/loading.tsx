import { SiteNav } from "@/app/components/SiteNav";

function SettingsCardSkeleton() {
  return (
    <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
      <div className="skeleton-shimmer h-6 w-36 rounded" />
      <div className="skeleton-shimmer mt-3 h-3 w-56 rounded" />
      <div className="mt-4 space-y-2">
        <div className="skeleton-shimmer h-10 rounded-lg" />
        <div className="skeleton-shimmer h-10 rounded-lg" />
      </div>
    </article>
  );
}

export default function TeamSettingsLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />
      <section className="mb-6 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <div className="skeleton-shimmer h-3 w-24 rounded" />
        <div className="skeleton-shimmer mt-3 h-8 w-2/3 rounded" />
        <div className="skeleton-shimmer mt-3 h-4 w-3/4 rounded" />
      </section>
      <section className="grid gap-6 lg:grid-cols-2" aria-hidden="true">
        <SettingsCardSkeleton />
        <SettingsCardSkeleton />
        <SettingsCardSkeleton />
        <SettingsCardSkeleton />
      </section>
    </main>
  );
}
