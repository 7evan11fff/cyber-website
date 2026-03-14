"use client";

import { useEffect } from "react";
import { ErrorFallbackCard } from "@/app/components/ErrorBoundary";

export default function BulkError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Bulk route error:", error);
  }, [error]);

  return (
    <ErrorFallbackCard
      error={error}
      title="Bulk scan hit an unexpected issue."
      description="Try the bulk scan again. If the issue persists, check your network and retry after a moment."
      retryLabel="Retry bulk scan"
      onRetry={reset}
    />
  );
}
