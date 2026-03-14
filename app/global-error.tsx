"use client";

import { useEffect, useTransition } from "react";
import { ErrorFallbackCard } from "@/app/components/ErrorBoundary";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isRetrying, startRetryTransition] = useTransition();

  useEffect(() => {
    console.error("Global app error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <ErrorFallbackCard
          error={error}
          title="We hit an unrecoverable issue."
          description="Refresh the page to retry. If this keeps happening, return to the scanner while we investigate."
          retryLabel={isRetrying ? "Retrying..." : "Retry app"}
          onRetry={() => {
            startRetryTransition(() => reset());
          }}
        />
      </body>
    </html>
  );
}
