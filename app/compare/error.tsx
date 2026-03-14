"use client";

import { useEffect } from "react";
import { ErrorFallbackCard } from "@/app/components/ErrorBoundary";

export default function CompareError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Compare route error:", error);
  }, [error]);

  return (
    <ErrorFallbackCard
      error={error}
      title="Comparison view failed to load."
      description="Retry the comparison page first. If it still fails, reload and try again shortly."
      retryLabel="Retry compare page"
      onRetry={reset}
    />
  );
}
