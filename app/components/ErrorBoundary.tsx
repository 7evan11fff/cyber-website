"use client";

import Link from "next/link";
import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorFallbackCardProps = {
  error?: Error | null;
  title: string;
  description: string;
  retryLabel: string;
  onRetry?: () => void;
};

function resolveIncidentId(error?: Error | null): string {
  if (!error) return "unavailable";
  const candidate = error as Error & { digest?: string };
  return candidate.digest ?? "unavailable";
}

export function ErrorFallbackCard({
  error,
  title,
  description,
  retryLabel,
  onRetry
}: ErrorFallbackCardProps) {
  const incidentId = resolveIncidentId(error);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-start justify-center px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-300">Unexpected error</p>
      <h1 className="mt-3 text-3xl font-semibold text-slate-100">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-300">{description}</p>
      <p className="mt-2 text-xs text-slate-500">
        Incident ID: <code className="rounded bg-slate-900 px-1.5 py-0.5 text-slate-300">{incidentId}</code>
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          disabled={!onRetry}
          className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {retryLabel}
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
        >
          Reload page
        </button>
        <Link
          href="/"
          className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
        >
          Back to scanner
        </Link>
      </div>
    </main>
  );
}

type ErrorBoundaryProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  retryLabel?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    console.error("Client error boundary caught an error:", error, errorInfo);
  }

  private onRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <ErrorFallbackCard
          error={this.state.error}
          title={this.props.title ?? "Something went wrong while rendering this screen."}
          description={
            this.props.description ??
            "Try again first. If the issue continues, reload the page or return to the scanner while we investigate."
          }
          retryLabel={this.props.retryLabel ?? "Try again"}
          onRetry={this.onRetry}
        />
      );
    }

    return this.props.children;
  }
}
