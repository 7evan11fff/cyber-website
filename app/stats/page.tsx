import type { Metadata } from "next";
import { PublicStatsDashboard } from "@/app/components/PublicStatsDashboard";
import { SiteNav } from "@/app/components/SiteNav";
import { getPublicStatsSnapshot } from "@/lib/publicStatsStore";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Public Stats",
  description:
    "Anonymous, aggregated security-header scanning statistics including grade distribution, missing headers, and score trends.",
  path: "/stats",
  keywords: [
    "security headers stats",
    "website security trends",
    "security grade distribution",
    "missing security headers"
  ]
});

export const dynamic = "force-dynamic";

export default async function PublicStatsPage() {
  const stats = await getPublicStatsSnapshot(30);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />

      <section className="mb-6 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Public statistics</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100 sm:text-3xl">Platform-wide security header trends</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          This dashboard only uses anonymized aggregates. No specific domains or report URLs are published here.
        </p>
      </section>

      <PublicStatsDashboard stats={stats} />
    </main>
  );
}
