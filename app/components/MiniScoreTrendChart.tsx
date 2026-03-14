type MiniScoreTrendPoint = {
  label: string;
  value: number | null;
};

type MiniScoreTrendChartProps = {
  points: MiniScoreTrendPoint[];
  className?: string;
  ariaLabel?: string;
};

const MAX_SCORE = 5;

export function MiniScoreTrendChart({
  points,
  className,
  ariaLabel = "Seven day watchlist trend"
}: MiniScoreTrendChartProps) {
  const width = 280;
  const height = 96;
  const paddingX = 12;
  const paddingY = 10;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const chartPoints = points.map((point, index) => {
    const x = points.length > 1 ? paddingX + (index / (points.length - 1)) * chartWidth : width / 2;
    if (point.value === null) {
      return {
        x,
        y: paddingY + chartHeight,
        label: point.label,
        value: null as number | null
      };
    }
    const clamped = Math.max(1, Math.min(MAX_SCORE, point.value));
    const y = paddingY + ((MAX_SCORE - clamped) / (MAX_SCORE - 1)) * chartHeight;
    return { x, y, label: point.label, value: clamped };
  });

  const linePoints = chartPoints
    .filter((point): point is { x: number; y: number; label: string; value: number } => point.value !== null)
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
      className={className}
    >
      <defs>
        <linearGradient id="mini-score-line" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(56,189,248,0.7)" />
          <stop offset="100%" stopColor="rgba(16,185,129,0.9)" />
        </linearGradient>
      </defs>
      <line
        x1={paddingX}
        y1={paddingY + chartHeight}
        x2={width - paddingX}
        y2={paddingY + chartHeight}
        stroke="currentColor"
        strokeOpacity={0.24}
        strokeWidth={1}
      />
      {linePoints ? (
        <polyline
          points={linePoints}
          fill="none"
          stroke="url(#mini-score-line)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="chart-line-reveal"
        />
      ) : (
        <line
          x1={paddingX}
          y1={paddingY + chartHeight / 2}
          x2={width - paddingX}
          y2={paddingY + chartHeight / 2}
          stroke="currentColor"
          strokeOpacity={0.45}
          strokeWidth={1.5}
        />
      )}
      {chartPoints.map((point, index) => (
        <circle
          key={`mini-score-point-${point.label}-${index}`}
          cx={point.x}
          cy={point.y}
          r={point.value === null ? 2 : 2.6}
          fill={point.value === null ? "rgba(148,163,184,0.45)" : "rgba(56,189,248,0.95)"}
          className={point.value === null ? undefined : "chart-point-reveal"}
          style={point.value === null ? undefined : { animationDelay: `${index * 55}ms` }}
        />
      ))}
    </svg>
  );
}
