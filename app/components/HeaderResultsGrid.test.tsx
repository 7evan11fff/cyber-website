import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeaderResultsGrid } from "@/app/components/HeaderResultsGrid";
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

describe("HeaderResultsGrid", () => {
  it("renders headers with default grid layout and prefixed card ids", () => {
    const headers = [
      buildHeader(),
      buildHeader({
        key: "strict-transport-security",
        label: "Strict-Transport-Security"
      })
    ];
    const { container } = render(<HeaderResultsGrid headers={headers} cardIdPrefix="scan-header" onSelect={vi.fn()} />);

    const grid = container.firstElementChild as HTMLElement;
    expect(grid).toHaveClass("grid");
    expect(grid).toHaveClass("gap-4");
    expect(grid).toHaveClass("sm:grid-cols-2");

    const firstCard = screen.getByRole("button", { name: "Open deep dive for Content-Security-Policy" });
    const secondCard = screen.getByRole("button", { name: "Open deep dive for Strict-Transport-Security" });
    expect(firstCard).toHaveAttribute("id", "scan-header-content-security-policy");
    expect(secondCard).toHaveAttribute("id", "scan-header-strict-transport-security");
  });

  it("renders highlighted cards and calls onSelect when card is clicked", () => {
    const onSelect = vi.fn();
    const header = buildHeader({ key: "x-frame-options", label: "X-Frame-Options", status: "weak", riskLevel: "medium" });
    render(
      <HeaderResultsGrid
        headers={[header]}
        cardIdPrefix="result"
        highlightedHeaderKeys={new Set(["x-frame-options"])}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText("Diff")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open deep dive for X-Frame-Options" }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: "x-frame-options" }));
  });

  it("uses custom class names and shows shortcuts for the first six cards", () => {
    const headers = Array.from({ length: 7 }, (_, index) =>
      buildHeader({
        key: `header-${index + 1}`,
        label: `Header ${index + 1}`
      })
    );

    render(
      <HeaderResultsGrid
        headers={headers}
        cardIdPrefix="shortcuts"
        className="grid grid-cols-1 gap-2"
        showShortcuts
        onSelect={vi.fn()}
      />
    );

    const firstCard = screen.getByRole("button", { name: "Open deep dive for Header 1" });
    const sixthCard = screen.getByRole("button", { name: "Open deep dive for Header 6" });
    const seventhCard = screen.getByRole("button", { name: "Open deep dive for Header 7" });

    expect(firstCard).toHaveAttribute("data-header-shortcut", "1");
    expect(sixthCard).toHaveAttribute("data-header-shortcut", "6");
    expect(seventhCard).not.toHaveAttribute("data-header-shortcut");
  });

  it("supports keyboard navigation between cards with arrow keys", () => {
    const scrollSpy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollSpy
    });

    render(
      <HeaderResultsGrid
        headers={[
          buildHeader(),
          buildHeader({
            key: "x-content-type-options",
            label: "X-Content-Type-Options"
          })
        ]}
        cardIdPrefix="keyboard-nav"
        onSelect={vi.fn()}
      />
    );

    const firstCard = screen.getByRole("button", { name: "Open deep dive for Content-Security-Policy" });
    const secondCard = screen.getByRole("button", { name: "Open deep dive for X-Content-Type-Options" });

    firstCard.focus();
    fireEvent.keyDown(firstCard, { key: "ArrowRight" });
    expect(secondCard).toHaveFocus();

    fireEvent.keyDown(secondCard, { key: "ArrowLeft" });
    expect(firstCard).toHaveFocus();
    expect(scrollSpy).toHaveBeenCalled();
  });
});
