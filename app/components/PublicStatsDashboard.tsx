import Link from "next/link";
import type { CSSProperties } from "react";
import type { PublicStatsSnapshot } from "@/lib/publicStatsStore";

type PublicStatsDashboardProps = {
  stats: PublicStatsSnapshot;
};

const GRADE_COLORS: Record<string, string> = {
  A: "#10b981",
  B: "#84cc16",
  C: "#f59e0b",
  D: "#fb7185",
  F: "#ef4444"
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number | null): string {
  if (value === null) return "--";
  return `${value.toFixed(1)}%`;
}

function buildPieBackground(distribution: PublicStatsSnapshot["gradeDistribution"]): CSSProperties {
  const total = distribution.reduce((sum, item) => sum + item.count, 0);
  if (total <= 0) {
    return {
      background: "conic-gradient(rgba(71,85,105,0.65) 0deg 360deg)"
    };
  }

  let cursor = 0;
  const segments = distribution.map((item) => {
    const ratio = item.count / total;
    const next = cursor + ratio * 360;
    const segment = `${GRADE_COLORS[item.grade]} ${cursor.toFixed(2)}deg ${next.toFixed(2)}deg`;
    cursor = next;
    return segment;
  });
  return {
    background: `conic-gradient(${segments.join(", ")})`
  };
}

function buildTrendPolyline(points: PublicStatsSnapshot["scoreTrend"], width: number, height: number): string | null {
  const withValue = points
    .map((point, index) => ({
      index,
      value: point.averageScorePercent
    }))
    .filter((point): point is { index: number; value: number } => point.value !== null);

  if (withValue.length < 2) return null;
  return withValue
    .map((point) => {
      const x = points.length > 1 ? (point.index / (points.length - 1)) * width : width / 2;
      const y = 6 + ((100 - point.value) / 100) * (height - 12);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildTrendDots(points: PublicStatsSnapshot["scoreTrend"], width: number, height: number) {
  return points
    .map((point, index) => {
      if (point.averageScorePercent === null) return null;
      const x = points.length > 1 ? (index / (points.length - 1)) * width : width / 2;
      const y = 6 + ((100 - point.averageScorePercent) / 100) * (height - 12);
      return { x, y, label: point.label, value: point.averageScorePercent };
    })
    .filter((point): point is { x: number; y: number; label: string; value: number } => Boolean(point));
}

export function PublicStatsDashboard({ stats }: PublicStatsDashboardProps) {
  const pieStyle = buildPieBackground(stats.gradeDistribution);
  const totalGradeSamples = stats.gradeDistribution.reduce((sum, item) => sum + item.count, 0);
  const totalMissingSamples = stats.missingHeaders.reduce((sum, item) => sum + item.count, 0);
  const chartWidth = 720;
  const chartHeight = 220;
  const trendLine = buildTrendPolyline(stats.scoreTrend, chartWidth, chartHeight);
  const trendDots = buildTrendDots(stats.scoreTrend, chartWidth, chartHeight);
  const trendValues = stats.scoreTrend
    .map((point) => point.averageScorePercent)
    .filter((value): value is number => value !== null);
  const firstTrend = trendValues[0] ?? null;
  const latestTrend = trendValues[trendValues.length - 1] ?? null;
  const trendDelta = firstTrend !== null && latestTrend !== null ? Number((latestTrend - firstTrend).toFixed(1)) : null;
  const trendDeltaTone =
    trendDelta === null
      ? "border-slate-700 bg-slate-900/80 text-slate-300"
      : trendDelta > 0
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
        : trendDelta < 0
          ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
          : "border-slate-700 bg-slate-900/80 text-slate-300";

  return (
    <section className="lazy-section space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="motion-card rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/50">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Total scans (all time)</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{formatNumber(stats.totalScansAllTime)}</p>
        </article>
        <article className="motion-card rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/50">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Scans today</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{formatNumber(stats.totalScansToday)}</p>
        </article>
        <article className="motion-card rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/50">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Average score</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{formatPercent(stats.averageScorePercent)}</p>
          <p className="mt-1 text-xs text-slate-500">Across all recorded scans</p>
        </article>
        <article className="motion-card rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/50">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Data freshness</p>
          <p className="mt-2 text-sm font-medium text-slate-200">
            {stats.updatedAt ? new Date(stats.updatedAt).toLocaleString() : "Waiting for first scan"}
          </p>
          <p className="mt-1 text-xs text-slate-500">Anonymous and aggregated only</p>
        </article>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="motion-card rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">Grade distribution</h2>
            <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
              {formatNumber(totalGradeSamples)} scans
            </span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="mx-auto h-40 w-40 rounded-full border border-slate-700/80 p-2 shadow-inner shadow-slate-950/50">
              <div className="relative h-full w-full rounded-full" style={pieStyle}>
                <div className="absolute inset-[24%] flex items-center justify-center rounded-full border border-slate-700/70 bg-slate-950/90 text-center">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Samples</p>
                    <p className="text-lg font-semibold text-slate-100">{formatNumber(totalGradeSamples)}</p>
                  </div>
                </div>
              </div>
            </div>
            <ul className="space-y-2">
              {stats.gradeDistribution.map((slice) => (
                <li key={`grade-slice-${slice.grade}`} className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-sm text-slate-200">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: GRADE_COLORS[slice.grade] }}
                      aria-hidden="true"
                    />
                    Grade {slice.grade}
                  </span>
                  <span className="text-sm text-slate-300">
                    {slice.percentage.toFixed(1)}% <span className="text-xs text-slate-500">({formatNumber(slice.count)})</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="motion-card rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">Most commonly missing headers</h2>
            <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
              {formatNumber(totalMissingSamples)} misses
            </span>
          </div>
          {stats.missingHeaders.length === 0 ? (
            <div className="mt-4 rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
              <p className="text-sm text-slate-300">Missing-header stats will populate after more scans are recorded.</p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {stats.missingHeaders.map((item) => (
                <li key={`missing-header-${item.key}`} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-slate-200">{item.label}</span>
                    <span className="shrink-0 text-slate-400">
                      {item.percentage.toFixed(1)}% <span className="text-xs text-slate-500">({formatNumber(item.count)})</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800/90">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"
                      style={{ width: `${Math.max(4, item.percentage)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <article className="motion-card rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-100">Average score trend</h2>
          <span className={`inline-flex rounded-md border px-2 py-1 text-xs ${trendDeltaTone}`}>
            {trendDelta === null ? "Collecting baseline" : `${trendDelta > 0 ? "+" : ""}${trendDelta}% over window`}
          </span>
        </div>
        <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label="Average score trend over time"
            className="h-56 w-full text-sky-300"
            preserveAspectRatio="none"
          >
            {[0, 25, 50, 75, 100].map((tick) => {
              const y = 6 + ((100 - tick) / 100) * (chartHeight - 12);
              return (
                <g key={`trend-grid-${tick}`}>
                  <line x1={0} y1={y} x2={chartWidth} y2={y} stroke="currentColor" strokeOpacity={0.12} strokeWidth={1} />
                  <text x={6} y={y - 3} fill="currentColor" fillOpacity={0.55} fontSize={11}>
                    {tick}%
                  </text>
                </g>
              );
            })}
            {trendLine ? (
              <polyline
                points={trendLine}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="chart-line-reveal"
              />
            ) : null}
            {trendDots.map((dot, index) => (
              <circle
                key={`trend-dot-${dot.label}-${index}`}
                cx={dot.x}
                cy={dot.y}
                r={index === trendDots.length - 1 ? 4 : 3}
                fill="currentColor"
                fillOpacity={index === trendDots.length - 1 ? 1 : 0.85}
                className="chart-point-reveal"
              />
            ))}
          </svg>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-500 sm:grid-cols-6 lg:grid-cols-10">
            {stats.scoreTrend
              .filter((_, index, all) => {
                const step = Math.ceil(all.length / 10);
                return index % step === 0 || index === all.length - 1;
              })
              .map((point) => (
                <span key={`trend-label-${point.date}`} className="truncate">
                  {point.label}
                </span>
              ))}
          </div>
        </div>
      </article>

      <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-r from-sky-500/10 via-slate-900/60 to-cyan-500/10 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-sky-300">Ready to improve your grade?</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-100">Scan your site now</h2>
          </div>
          <Link
            href="/"
            className="cta-attention inline-flex min-h-11 items-center rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
          >
            Scan your site
          </Link>
        </div>
      </div>
    </section>
  );
}
