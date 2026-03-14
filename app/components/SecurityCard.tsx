"use client";

import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { FixSuggestion } from "@/app/components/FixSuggestion";
import type { DetectedFramework } from "@/lib/frameworkDetection";
import type { HeaderResult } from "@/lib/securityHeaders";

const statusStyles: Record<HeaderResult["status"], string> = {
  good: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30",
  weak: "bg-amber-500/20 text-amber-300 ring-amber-500/30",
  missing: "bg-rose-500/20 text-rose-300 ring-rose-500/30"
};

type SecurityCardProps = {
  header: HeaderResult;
  detectedFramework?: DetectedFramework | null;
  highlighted?: boolean;
  animationDelayMs?: number;
  shortcutNumber?: number;
  onSelect?: (header: HeaderResult) => void;
  cardId?: string;
};

export function SecurityCard({
  header,
  detectedFramework,
  highlighted = false,
  animationDelayMs = 0,
  shortcutNumber,
  onSelect,
  cardId
}: SecurityCardProps) {
  const interactive = typeof onSelect === "function";
  const onCardKeyDown =
    interactive
      ? (event: ReactKeyboardEvent<HTMLElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            onSelect?.(header);
            return;
          }

          if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) {
            return;
          }

          const allCards = Array.from(document.querySelectorAll<HTMLElement>('[data-header-result-card="true"]'));
          const visibleCards = allCards.filter((card) => card.getClientRects().length > 0);
          const navigableCards = visibleCards.length > 0 ? visibleCards : allCards;
          const currentIndex = navigableCards.findIndex((card) => card === event.currentTarget);
          if (currentIndex < 0 || navigableCards.length <= 1) return;

          const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
          const nextIndex = (currentIndex + direction + navigableCards.length) % navigableCards.length;
          const nextCard = navigableCards[nextIndex];
          if (!nextCard) return;

          event.preventDefault();
          event.stopPropagation();
          nextCard.focus();
          nextCard.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        }
      : undefined;

  return (
    <article
      id={cardId}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `Open deep dive for ${header.label}` : undefined}
      data-header-result-card={interactive ? "true" : undefined}
      data-header-shortcut={typeof shortcutNumber === "number" ? String(shortcutNumber) : undefined}
      onClick={interactive ? () => onSelect?.(header) : undefined}
      onKeyDown={onCardKeyDown}
      className={`motion-card stagger-card-enter rounded-2xl border p-5 shadow-lg ${
        highlighted
          ? "border-sky-500/60 bg-sky-500/10 shadow-sky-950/40"
          : "border-slate-800 bg-slate-900/60 shadow-slate-950/50"
      } ${interactive ? "cursor-pointer transition hover:border-sky-500/50" : ""}`}
      style={{ animationDelay: `${animationDelayMs}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-100">{header.label}</h2>
        <div className="flex items-center gap-2">
          {typeof shortcutNumber === "number" && (
            <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-300">
              {shortcutNumber}
            </span>
          )}
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
      {header.status !== "good" && <FixSuggestion header={header} detectedFramework={detectedFramework} />}
    </article>
  );
}
