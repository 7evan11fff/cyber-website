import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FixSuggestion } from "@/app/components/FixSuggestion";
import type { HeaderResult } from "@/lib/securityHeaders";

function buildHeader(overrides: Partial<HeaderResult> = {}): HeaderResult {
  return {
    key: "content-security-policy",
    label: "Content-Security-Policy",
    value: null,
    present: false,
    status: "missing",
    riskLevel: "high",
    whyItMatters: "Limits where scripts can load from.",
    guidance: "Add a strict policy.",
    ...overrides
  };
}

describe("FixSuggestion", () => {
  it("does not render for good headers", () => {
    const { container } = render(
      <FixSuggestion
        header={buildHeader({
          value: "default-src 'self'",
          present: true,
          status: "good",
          riskLevel: "low"
        })}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows framework-specific snippets and prioritizes detected framework", () => {
    render(
      <FixSuggestion
        header={buildHeader()}
        detectedFramework={{
          id: "nextjs",
          label: "Next.js",
          reason: "Detected from X-Powered-By response header.",
          evidence: [{ header: "x-powered-by", value: "Next.js" }]
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /toggle fix suggestions/i }));

    expect(screen.getByText(/Detected stack:/)).toBeInTheDocument();
    expect(screen.getByText("Quick HTML fallback (CSP meta tag)")).toBeInTheDocument();
    expect(screen.getByText("Vercel config")).toBeInTheDocument();
    expect(screen.getByText("Cloudflare")).toBeInTheDocument();
    expect(screen.getByText(/app\/middleware.ts/)).toBeInTheDocument();
  });

  it("shows modern x-frame guidance note", () => {
    render(
      <FixSuggestion
        header={buildHeader({
          key: "x-frame-options",
          label: "X-Frame-Options",
          value: "ALLOW-FROM https://example.com",
          status: "weak",
          present: true,
          riskLevel: "medium"
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /toggle fix suggestions for x-frame-options/i }));
    expect(screen.getByText(/frame-ancestors as the modern control/i)).toBeInTheDocument();
  });
});
