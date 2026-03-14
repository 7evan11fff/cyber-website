import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { DashboardActions } from "@/app/components/DashboardActions";
import { SiteNav } from "@/app/components/SiteNav";
import { TrendChart } from "@/app/components/TrendChart";
import { authOptions } from "@/lib/auth";
import { getGradeChangeAnnotations, getTrendDirection, type TrendDirection } from "@/lib/gradeTrends";
import { getDomainKeyFromUrl } from "@/lib/userData";
import { getUserDataForUser, getUserKeyFromSessionUser } from "@/lib/userDataStore";

export const metadata: Metadata = {
  title: "Watchlist history",
  description: "Detailed watchlist trend history for a monitored domain.",
  alternates: { canonical: "/dashboard" },
  robots: { index: false, follow: false }
};

const toneByTrend: Record<
  TrendDirection,
  {
    text: string;
    className: string;
    chartClassName: string;
  }
> = {
  improving: {
    text: "Improving",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    chartClassName: "text-emerald-300"
  },
  degrading: {
    text: "Degrading",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    chartClassName: "text-rose-300"
  },
  stable: {
    text: "Stable",
    className: "border-slate-700 bg-slate-900/80 text-slate-300",
    chartClassName: "text-slate-300"
  }
};

export default async function WatchlistHistoryPage({
  params
}: {
  params: { domain: string };
}) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!session?.user || !userKey) {
    redirect("/auth/signin?callbackUrl=/dashboard");
  }

  const decodedParam = decodeURIComponent(params.domain);
  const domain = getDomainKeyFromUrl(decodedParam);
  if (!domain) {
    notFound();
  }

  const userData = await getUserDataForUser(userKey);
  const domainHistory = userData.history[domain] ?? [];
  const trend = getTrendDirection(domainHistory);
  const tone = toneByTrend[trend];
  const chartPoints = [...domainHistory].sort(
    (a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime()
  );
  const scansNewestFirst = [...chartPoints].reverse();
  const annotations = getGradeChangeAnnotations(domainHistory).reverse();

  const changeByTimestamp = new Map<
    string,
    {
      text: string;
      className: string;
    }
  >();
  for (const annotation of annotations) {
    const prefix =
      annotation.direction === "improving"
        ? "Improved"
        : annotation.direction === "degrading"
          ? "Regressed"
          : "Changed";
    const annotationClass =
      annotation.direction === "improving"
        ? "text-emerald-300"
        : annotation.direction === "degrading"
          ? "text-rose-300"
          : "text-slate-300";
    changeByTimestamp.set(annotation.checkedAt, {
      text: `${prefix}: ${annotation.from} -> ${annotation.to}`,
      className: annotationClass
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />

      <section className="mb-6 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Watchlist history</p>
        <h1 className="mt-2 break-all text-2xl font-semibold text-slate-100 sm:text-3xl">{domain}</h1>
        <p className="mt-2 text-sm text-slate-300">
          Signed in as <span className="font-medium text-slate-100">{session.user.email ?? session.user.name}</span>
        </p>
        <DashboardActions />
      </section>

      <section className="lazy-section grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">Score trend over time</h2>
            <span className={`rounded-md border px-2 py-1 text-xs ${tone.className}`}>{tone.text}</span>
          </div>
          {chartPoints.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              No historical data yet. Run scans and refresh this watchlist entry to build trends.
            </p>
          ) : (
            <>
              <TrendChart
                points={chartPoints}
                width={640}
                height={200}
                className={`mt-4 h-44 w-full sm:h-52 ${tone.chartClassName}`}
                ariaLabel={`Grade trend over time for ${domain}`}
              />
              <p className="mt-2 text-xs text-slate-500">
                Showing {Math.min(chartPoints.length, 30)} retained points (max 30, last 90 days).
              </p>
            </>
          )}
        </article>

        <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
          <h2 className="text-lg font-semibold text-slate-100">Grade changes</h2>
          {annotations.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No grade changes recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {annotations.map((annotation, index) => {
                const label =
                  annotation.direction === "improving"
                    ? "Improved"
                    : annotation.direction === "degrading"
                      ? "Regressed"
                      : "Changed";
                const itemClass =
                  annotation.direction === "improving"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : annotation.direction === "degrading"
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                      : "border-slate-700 bg-slate-900/80 text-slate-200";

                return (
                  <li key={`${annotation.checkedAt}-${index}`} className={`rounded-md border px-3 py-2 ${itemClass}`}>
                    <p className="text-sm">
                      {label}: {annotation.from} -&gt; {annotation.to}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{new Date(annotation.checkedAt).toLocaleString()}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      </section>

      <section className="lazy-section mt-6 rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-100">Historical scans</h2>
          <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
            {scansNewestFirst.length} entries
          </span>
        </div>

        {scansNewestFirst.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No scans recorded for this domain.</p>
        ) : (
          <>
            <p className="mt-2 text-xs text-slate-400 sm:hidden">Scroll horizontally to view all table columns.</p>
            <div className="mt-4 overflow-x-auto" role="region" aria-label="Historical scan table for this domain">
              <table className="min-w-[560px] divide-y divide-slate-800 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Grade</th>
                  <th className="px-3 py-2 font-medium">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {scansNewestFirst.map((entry) => {
                  const change = changeByTimestamp.get(entry.checkedAt);
                  return (
                    <tr key={`${entry.checkedAt}-${entry.grade}`}>
                      <td className="px-3 py-2 text-slate-300">{new Date(entry.checkedAt).toLocaleString()}</td>
                      <td className="px-3 py-2 font-semibold text-sky-200">{entry.grade}</td>
                      <td className={`px-3 py-2 text-xs ${change?.className ?? "text-slate-500"}`}>
                        {change?.text ?? "No change"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        )}
      </section>

      <Link
        href="/dashboard"
        className="mt-6 inline-flex w-fit rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
