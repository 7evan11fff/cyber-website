"use client";

import { useEffect, useTransition } from "react";
import { ErrorFallbackCard } from "@/app/components/ErrorBoundary";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isRetrying, startRetryTransition] = useTransition();

  useEffect(() => {
    console.error("App route error:", error);
  }, [error]);

  return (
    <ErrorFallbackCard
      error={error}
      title="Something went wrong while loading this page."
      description="Retry this page first. If the issue persists, return to the scanner and try again later while we investigate."
      retryLabel={isRetrying ? "Retrying..." : "Try again"}
      onRetry={() => {
        startRetryTransition(() => reset());
      }}
    />
  );
}
