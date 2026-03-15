"use client";

import type { ReactNode, TouchEventHandler } from "react";

type ScanResultsPanelProps = {
  pullRefreshing: boolean;
  pullRefreshDistance: number;
  pullRefreshLabel: string;
  loadingContent?: ReactNode;
  onTouchStart: TouchEventHandler<HTMLElement>;
  onTouchMove: TouchEventHandler<HTMLElement>;
  onTouchEnd: TouchEventHandler<HTMLElement>;
  children: ReactNode;
};

export function ScanResultsPanel({
  pullRefreshing,
  pullRefreshDistance,
  pullRefreshLabel,
  loadingContent,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  children
}: ScanResultsPanelProps) {
  return (
    <section
      id="scan-results-area"
      className="relative overscroll-y-contain"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      aria-label="Main scan results area"
    >
      <div
        className="pointer-events-none flex justify-center transition-all duration-150"
        style={{
          maxHeight: pullRefreshing || pullRefreshDistance > 0 ? 42 : 0,
          opacity: pullRefreshing || pullRefreshDistance > 0 ? 1 : 0
        }}
        aria-hidden="true"
      >
        <p className="inline-flex min-h-9 items-center rounded-full border border-sky-500/30 bg-slate-900/90 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-sky-200">
          {pullRefreshLabel}
        </p>
      </div>
      {loadingContent}

      <div className="lazy-section">{children}</div>
    </section>
  );
}
