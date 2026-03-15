"use client";

import { SecurityCard } from "@/app/components/SecurityCard";
import type { DetectedFramework } from "@/lib/frameworkDetection";
import type { HeaderResult } from "@/lib/securityHeaders";

type HeaderResultsGridProps = {
  headers: HeaderResult[];
  cardIdPrefix: string;
  detectedFramework?: DetectedFramework | null;
  highlightedHeaderKeys?: ReadonlySet<string>;
  animationStepMs?: number;
  showShortcuts?: boolean;
  onSelect: (header: HeaderResult) => void;
  className?: string;
};

export function HeaderResultsGrid({
  headers,
  cardIdPrefix,
  detectedFramework,
  highlightedHeaderKeys,
  animationStepMs = 55,
  showShortcuts = false,
  onSelect,
  className = "grid gap-4 sm:grid-cols-2"
}: HeaderResultsGridProps) {
  return (
    <div className={className}>
      {headers.map((header, index) => (
        <SecurityCard
          key={`${cardIdPrefix}-${header.key}`}
          cardId={`${cardIdPrefix}-${header.key}`}
          header={header}
          detectedFramework={detectedFramework}
          highlighted={highlightedHeaderKeys?.has(header.key)}
          animationDelayMs={index * animationStepMs}
          shortcutNumber={showShortcuts && index < 6 ? index + 1 : undefined}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
