import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SecurityCard } from "@/app/components/SecurityCard";
import type { HeaderResult } from "@/lib/securityHeaders";

function buildHeader(overrides: Partial<HeaderResult> = {}): HeaderResult {
  return {
    key: "content-security-policy",
    label: "Content-Security-Policy",
    value: "default-src 'self'",
    present: true,
    status: "good",
    riskLevel: "low",
    whyItMatters: "Limits where scripts can load from.",
    guidance: "Keep it strict.",
    ...overrides
  };
}

describe("SecurityCard", () => {
  it("renders header details and highlighted difference marker", () => {
    render(<SecurityCard header={buildHeader()} highlighted animationDelayMs={120} />);

    expect(screen.getByRole("heading", { name: "Content-Security-Policy" })).toBeInTheDocument();
    expect(screen.getByText("good")).toBeInTheDocument();
    expect(screen.getByText("Diff")).toBeInTheDocument();
    expect(screen.getByText("Limits where scripts can load from.")).toBeInTheDocument();
    expect(screen.getByText("default-src 'self'")).toBeInTheDocument();
    expect(screen.getByText(/Recommendation:/)).toBeInTheDocument();
    expect(screen.queryByText("How to fix")).not.toBeInTheDocument();
  });

  it("shows missing value state when header value is absent", () => {
    render(
      <SecurityCard
        header={buildHeader({
          value: null,
          present: false,
          status: "missing"
        })}
      />
    );

    expect(screen.getByText("missing")).toBeInTheDocument();
    expect(screen.getByText("Missing")).toBeInTheDocument();
    expect(screen.queryByText("Diff")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /toggle fix suggestions/i })).toBeInTheDocument();
  });

  it("shows fix suggestions for weak headers", () => {
    render(
      <SecurityCard
        header={buildHeader({
          key: "x-frame-options",
          label: "X-Frame-Options",
          value: "ALLOW-FROM https://example.com",
          status: "weak",
          guidance: "Prefer DENY or SAMEORIGIN."
        })}
      />
    );

    expect(screen.getByText("weak")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /toggle fix suggestions for x-frame-options/i })).toBeInTheDocument();
  });
});
