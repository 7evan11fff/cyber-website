import type { DomainGradeHistoryPoint } from "@/lib/userData";
import { gradeToScore, sortHistoryAscending } from "@/lib/gradeTrends";

type TrendChartProps = {
  points: DomainGradeHistoryPoint[];
  width?: number;
  height?: number;
  className?: string;
  ariaLabel?: string;
};

export function TrendChart({
  points,
  width = 120,
  height = 38,
  className,
  ariaLabel = "Grade trend chart"
}: TrendChartProps) {
  const sorted = sortHistoryAscending(points).filter(
    (point) => Number.isFinite(new Date(point.checkedAt).getTime()) && gradeToScore(point.grade) > 0
  );

  const usable = sorted.length > 30 ? sorted.slice(sorted.length - 30) : sorted;
  const chartPoints = usable.map((point, index) => {
    const x = usable.length > 1 ? (index / (usable.length - 1)) * width : width / 2;
    const score = gradeToScore(point.grade);
    const y = 4 + ((5 - score) / 4) * (height - 8);
    return { x, y };
  });

  const sparkline =
    chartPoints.length > 1 ? chartPoints.map((point) => `${point.x},${point.y}`).join(" ") : null;
  const lastPoint = chartPoints[chartPoints.length - 1] ?? null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      aria-label={ariaLabel}
      role="img"
      className={className}
      preserveAspectRatio="none"
    >
      <line
        x1={0}
        y1={height - 4}
        x2={width}
        y2={height - 4}
        stroke="currentColor"
        strokeOpacity={0.22}
        strokeWidth={1}
      />
      {sparkline ? (
        <polyline
          points={sparkline}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <line
          x1={2}
          y1={height / 2}
          x2={width - 2}
          y2={height / 2}
          stroke="currentColor"
          strokeOpacity={0.5}
          strokeWidth={1.5}
        />
      )}
      {lastPoint && <circle cx={lastPoint.x} cy={lastPoint.y} r={2} fill="currentColor" />}
    </svg>
  );
}
