"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getTrendDirection, gradeToScore, sortHistoryAscending } from "@/lib/gradeTrends";
import { getDomainKeyFromUrl, type DomainGradeHistoryPoint, type DomainGradeHistoryRecord, type WatchlistEntry } from "@/lib/userData";

type WatchlistTrendRangeChartProps = {
  watchlist: WatchlistEntry[];
  history: DomainGradeHistoryRecord;
  className?: string;
};

type RangeOption = {
  id: "7d" | "30d" | "90d";
  label: string;
  days: 7 | 30 | 90;
};

type DomainSeries = {
  dataKey: string;
  domain: string;
  displayUrl: string;
  color: string;
  gradeRange: string;
  trendLabel: string;
  latestScore: number | null;
  valuesByDay: Map<string, number | null>;
};

type ChartRow = {
  isoDate: string;
  shortLabel: string;
  [key: string]: string | number | null;
};

const RANGE_OPTIONS: RangeOption[] = [
  { id: "7d", label: "7d", days: 7 },
  { id: "30d", label: "30d", days: 30 },
  { id: "90d", label: "90d", days: 90 }
];

function scoreToGrade(score: number | null): string {
  if (score === null) return "--";
  if (score >= 4.5) return "A";
  if (score >= 3.5) return "B";
  if (score >= 2.5) return "C";
  if (score >= 1.5) return "D";
  return "F";
}

function rangeTone(direction: "improving" | "degrading" | "stable") {
  if (direction === "improving") {
    return {
      line: "#34d399",
      badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      label: "Improving"
    };
  }
  if (direction === "degrading") {
    return {
      line: "#fb7185",
      badge: "border-rose-500/30 bg-rose-500/10 text-rose-300",
      label: "Regressing"
    };
  }
  return {
    line: "#38bdf8",
    badge: "border-slate-700 bg-slate-900/80 text-slate-300",
    label: "Stable"
  };
}

function normalizeDomainSeriesWatchlist(watchlist: WatchlistEntry[]): Array<{ domain: string; displayUrl: string }> {
  const deduped = new Map<string, string>();
  for (const entry of watchlist) {
    const domain = getDomainKeyFromUrl(entry.url);
    if (!domain || deduped.has(domain)) continue;
    deduped.set(domain, entry.url);
  }
  return Array.from(deduped.entries()).map(([domain, displayUrl]) => ({ domain, displayUrl }));
}

function buildDayAxis(days: number): Array<{ isoDate: string; shortLabel: string }> {
  const now = new Date();
  const axis: Array<{ isoDate: string; shortLabel: string }> = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
    axis.push({
      isoDate: date.toISOString().slice(0, 10),
      shortLabel: date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    });
  }
  return axis;
}

function buildValuesByDay(points: DomainGradeHistoryPoint[], dayAxis: Array<{ isoDate: string }>): Map<string, number | null> {
  const valuesByDay = new Map<string, number | null>(dayAxis.map((day) => [day.isoDate, null]));
  const sorted = sortHistoryAscending(points).filter((point) => Number.isFinite(new Date(point.checkedAt).getTime()));
  const latestPointByDay = new Map<string, DomainGradeHistoryPoint>();
  for (const point of sorted) {
    const dayKey = new Date(point.checkedAt).toISOString().slice(0, 10);
    if (!valuesByDay.has(dayKey)) continue;
    latestPointByDay.set(dayKey, point);
  }
  for (const day of dayAxis) {
    const point = latestPointByDay.get(day.isoDate);
    if (!point) continue;
    const score = gradeToScore(point.grade);
    valuesByDay.set(day.isoDate, score > 0 ? score : null);
  }
  return valuesByDay;
}

function formatTrendRange(points: DomainGradeHistoryPoint[]): string {
  const usable = points.filter((point) => gradeToScore(point.grade) > 0);
  if (usable.length < 2) {
    const only = usable[usable.length - 1];
    return only ? `Grade ${only.grade}` : "Collecting baseline";
  }
  const first = usable[0];
  const last = usable[usable.length - 1];
  return `${first.grade} -> ${last.grade}`;
}

export function WatchlistTrendRangeChart({ watchlist, history, className }: WatchlistTrendRangeChartProps) {
  const [activeRangeId, setActiveRangeId] = useState<RangeOption["id"]>("30d");
  const activeRange = useMemo(
    () => RANGE_OPTIONS.find((option) => option.id === activeRangeId) ?? RANGE_OPTIONS[1],
    [activeRangeId]
  );

  const domainWatchlist = useMemo(() => normalizeDomainSeriesWatchlist(watchlist), [watchlist]);

  const chartState = useMemo(() => {
    const dayAxis = buildDayAxis(activeRange.days);
    const cutoffIso = dayAxis[0]?.isoDate ?? "";

    const domainSeries: DomainSeries[] = domainWatchlist
      .map((entry, index) => {
        const sourcePoints = sortHistoryAscending(history[entry.domain] ?? []);
        const scopedPoints = sourcePoints.filter((point) => point.checkedAt.slice(0, 10) >= cutoffIso);
        const tone = rangeTone(getTrendDirection(scopedPoints));
        const valuesByDay = buildValuesByDay(scopedPoints, dayAxis);
        const latestPoint = scopedPoints[scopedPoints.length - 1] ?? null;
        return {
          dataKey: `domain-${index + 1}`,
          domain: entry.domain,
          displayUrl: entry.displayUrl,
          color: tone.line,
          gradeRange: formatTrendRange(scopedPoints),
          trendLabel: tone.label,
          latestScore: latestPoint ? gradeToScore(latestPoint.grade) : null,
          valuesByDay
        };
      })
      .filter((series) => Array.from(series.valuesByDay.values()).some((value) => value !== null));

    const rows: ChartRow[] = dayAxis.map((day) => {
      const row: ChartRow = { isoDate: day.isoDate, shortLabel: day.shortLabel };
      for (const series of domainSeries) {
        row[series.dataKey] = series.valuesByDay.get(day.isoDate) ?? null;
      }
      return row;
    });

    const domainLabelByDataKey = new Map(domainSeries.map((series) => [series.dataKey, series.domain]));
    return { rows, domainSeries, domainLabelByDataKey };
  }, [activeRange.days, domainWatchlist, history]);

  return (
    <section className={`rounded-xl border border-slate-800/90 bg-slate-950/60 p-4 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Historical trend view</p>
          <p className="mt-1 text-sm text-slate-300">
            Compare watchlist domains and spot grade improvements or regressions over time.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-1">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setActiveRangeId(option.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                activeRangeId === option.id
                  ? "bg-sky-500 text-slate-950"
                  : "text-slate-300 hover:text-sky-200"
              }`}
              aria-pressed={activeRangeId === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {domainWatchlist.length === 0 ? (
        <div className="mt-4 rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
          <p className="text-sm text-slate-300">
            Add domains to your watchlist to unlock multi-domain historical trend charts.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Tip: run a scan, save it to your watchlist, then refresh entries over time to build trend lines.
          </p>
        </div>
      ) : chartState.domainSeries.length === 0 ? (
        <div className="mt-4 rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
          <p className="text-sm text-slate-300">
            No chart points in the selected range yet. Try switching to 90d or running fresh watchlist scans.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 h-64 w-full rounded-lg border border-slate-800 bg-slate-950/70 p-2 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartState.rows} margin={{ top: 12, right: 14, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="shortLabel"
                  stroke="#94a3b8"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  minTickGap={24}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  domain={[1, 5]}
                  ticks={[1, 2, 3, 4, 5]}
                  axisLine={false}
                  tickLine={false}
                  width={34}
                />
                <Tooltip
                  cursor={{ stroke: "rgba(56,189,248,0.3)", strokeWidth: 1 }}
                  contentStyle={{
                    background: "rgba(2, 6, 23, 0.96)",
                    border: "1px solid rgba(71, 85, 105, 0.9)",
                    borderRadius: "0.75rem",
                    color: "#e2e8f0"
                  }}
                  labelFormatter={(_, payload) => {
                    const isoDate = payload?.[0]?.payload?.isoDate;
                    if (typeof isoDate !== "string") return "";
                    return new Date(`${isoDate}T00:00:00.000Z`).toLocaleDateString();
                  }}
                  formatter={(value, name) => {
                    const parsed = typeof value === "number" ? value : Number(value);
                    if (!Number.isFinite(parsed) || parsed <= 0) return ["No scan", chartState.domainLabelByDataKey.get(String(name)) ?? String(name)];
                    return [`${parsed.toFixed(2)}/5 (${scoreToGrade(parsed)})`, chartState.domainLabelByDataKey.get(String(name)) ?? String(name)];
                  }}
                />
                {chartState.domainSeries.map((series) => (
                  <Line
                    key={series.dataKey}
                    type="monotone"
                    dataKey={series.dataKey}
                    stroke={series.color}
                    strokeWidth={2.4}
                    dot={{ r: 2.2 }}
                    activeDot={{ r: 4.2 }}
                    connectNulls
                    isAnimationActive
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {chartState.domainSeries.map((series) => {
              const tone =
                series.trendLabel === "Improving"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : series.trendLabel === "Regressing"
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                    : "border-slate-700 bg-slate-900/80 text-slate-300";
              return (
                <li key={series.domain} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <p className="truncate text-sm font-medium text-slate-100">{series.displayUrl}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-md border px-2 py-1 text-xs ${tone}`}>{series.trendLabel}</span>
                    <span className="text-xs text-slate-400">{series.gradeRange}</span>
                    <span className="text-xs text-slate-400">
                      Latest {series.latestScore ? `${scoreToGrade(series.latestScore)} (${series.latestScore.toFixed(2)}/5)` : "--"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
