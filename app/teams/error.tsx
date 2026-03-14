"use client";

import { useEffect, useTransition } from "react";
import * as Sentry from "@sentry/nextjs";
import { ErrorFallbackCard } from "@/app/components/ErrorBoundary";

export default function TeamsError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isRetrying, startRetryTransition] = useTransition();

  useEffect(() => {
    console.error("Teams route error:", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <ErrorFallbackCard
      error={error}
      title="We couldn't load team data."
      description="Retry this team page. If the problem continues, head back to your dashboard while we investigate."
      retryLabel={isRetrying ? "Retrying..." : "Retry team page"}
      onRetry={() => {
        startRetryTransition(() => reset());
      }}
    />
  );
}
