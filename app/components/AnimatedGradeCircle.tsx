"use client";

import { useEffect, useMemo, useState } from "react";

type AnimatedGradeCircleProps = {
  score: number;
  total: number;
  grade: string;
  gradeClassName: string;
};

export function AnimatedGradeCircle({
  score,
  total,
  grade,
  gradeClassName
}: AnimatedGradeCircleProps) {
  const safeTotal = Math.max(total, 1);
  const cappedScore = Math.min(Math.max(score, 0), safeTotal);
  const progress = cappedScore / safeTotal;
  const [displayScore, setDisplayScore] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const onChange = () => setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayScore(cappedScore);
      return;
    }

    let rafId = 0;
    const startedAt = performance.now();
    const durationMs = 860;

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(cappedScore * eased));
      if (t < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [cappedScore, reducedMotion]);

  const strokeTransitionStyle = useMemo(
    () =>
      reducedMotion
        ? undefined
        : ({
            transition: "stroke-dashoffset 900ms cubic-bezier(0.2, 1, 0.32, 1)"
          } as const),
    [reducedMotion]
  );

  return (
    <div className="grade-badge-in grade-badge-glow relative mx-auto h-28 w-28 sm:h-36 sm:w-36">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Grade {grade} with score {displayScore} out of {safeTotal}
      </p>
      <svg viewBox="0 0 128 128" aria-hidden="true" className="h-full w-full -rotate-90 transform">
        <circle cx={64} cy={64} r={radius} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={10} />
        <circle
          cx={64}
          cy={64}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={10}
          strokeLinecap="round"
          className={gradeClassName}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={strokeTransitionStyle}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <p className={`text-4xl font-bold sm:text-5xl ${gradeClassName}`}>{grade}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
          {displayScore}/{safeTotal}
        </p>
      </div>
    </div>
  );
}
