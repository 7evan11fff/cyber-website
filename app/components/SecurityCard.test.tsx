import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

  it("opens header details with Enter and Space", () => {
    const onSelect = vi.fn();
    render(<SecurityCard header={buildHeader()} onSelect={onSelect} />);

    const card = screen.getByRole("button", { name: "Open deep dive for Content-Security-Policy" });
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });

    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenNthCalledWith(1, expect.objectContaining({ key: "content-security-policy" }));
  });

  it("supports arrow-key navigation between visible cards", () => {
    const scrollSpy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollSpy
    });

    const onSelect = vi.fn();
    render(
      <>
        <SecurityCard header={buildHeader()} onSelect={onSelect} />
        <SecurityCard
          header={buildHeader({
            key: "strict-transport-security",
            label: "Strict-Transport-Security"
          })}
          onSelect={onSelect}
        />
      </>
    );

    const first = screen.getByRole("button", { name: "Open deep dive for Content-Security-Policy" });
    const second = screen.getByRole("button", { name: "Open deep dive for Strict-Transport-Security" });

    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(second).toHaveFocus();

    fireEvent.keyDown(second, { key: "ArrowLeft" });
    expect(first).toHaveFocus();
    expect(scrollSpy).toHaveBeenCalled();
  });
});
