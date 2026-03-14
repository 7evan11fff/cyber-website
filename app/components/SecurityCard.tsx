"use client";

import type { HeaderResult } from "@/lib/securityHeaders";

const statusStyles: Record<HeaderResult["status"], string> = {
  good: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30",
  weak: "bg-amber-500/20 text-amber-300 ring-amber-500/30",
  missing: "bg-rose-500/20 text-rose-300 ring-rose-500/30"
};

type SecurityCardProps = {
  header: HeaderResult;
  highlighted?: boolean;
  animationDelayMs?: number;
};

export function SecurityCard({
  header,
  highlighted = false,
  animationDelayMs = 0
}: SecurityCardProps) {
  return (
    <article
      className={`motion-card stagger-card-enter rounded-2xl border p-5 shadow-lg ${
        highlighted
          ? "border-sky-500/60 bg-sky-500/10 shadow-sky-950/40"
          : "border-slate-800 bg-slate-900/60 shadow-slate-950/50"
      }`}
      style={{ animationDelay: `${animationDelayMs}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-100">{header.label}</h2>
        <div className="flex items-center gap-2">
          {highlighted && (
            <span className="rounded-full bg-sky-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-200 ring-1 ring-sky-500/40">
              Diff
            </span>
          )}
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ring-1 ${statusStyles[header.status]}`}
          >
            {header.status}
          </span>
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-300">{header.whyItMatters}</p>
      <p className="mt-3 text-sm text-slate-400">
        <span className="text-slate-500">Current value:</span>{" "}
        {header.value ? (
          <code className="break-all rounded bg-slate-950 px-1.5 py-0.5 text-xs text-slate-200">
            {header.value}
          </code>
        ) : (
          <span className="text-rose-200">Missing</span>
        )}
      </p>
      <p className="mt-3 text-sm text-slate-300">
        <span className="font-medium text-slate-200">Recommendation:</span> {header.guidance}
      </p>
    </article>
  );
}
