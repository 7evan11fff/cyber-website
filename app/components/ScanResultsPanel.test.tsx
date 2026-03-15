import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScanResultsPanel } from "@/app/components/ScanResultsPanel";

function buildProps(
  overrides: Partial<ComponentProps<typeof ScanResultsPanel>> = {}
): ComponentProps<typeof ScanResultsPanel> {
  return {
    pullRefreshing: false,
    pullRefreshDistance: 0,
    pullRefreshLabel: "Pull to refresh",
    loadingContent: null,
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
    children: <div>Loaded results</div>,
    ...overrides
  };
}

describe("ScanResultsPanel", () => {
  it("renders children and optional loading or error content", () => {
    render(
      <ScanResultsPanel
        {...buildProps({
          loadingContent: (
            <>
              <div>Loading current scan...</div>
              <p role="alert">Unable to refresh right now.</p>
            </>
          )
        })}
      />
    );

    expect(screen.getByText("Loaded results")).toBeInTheDocument();
    expect(screen.getByText("Loading current scan...")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to refresh right now.");
  });

  it("exposes accessible landmarks and hides pull indicator when idle", () => {
    render(<ScanResultsPanel {...buildProps()} />);

    const region = screen.getByRole("region", { name: "Main scan results area" });
    expect(region).toHaveAttribute("id", "scan-results-area");

    const pullLabel = screen.getByText("Pull to refresh");
    const indicator = pullLabel.closest("div");
    expect(indicator).toHaveStyle({ maxHeight: "0", opacity: "0" });
    expect(indicator).toHaveAttribute("aria-hidden", "true");
  });

  it("shows pull-to-refresh indicator while pulling or actively refreshing", () => {
    const { rerender } = render(
      <ScanResultsPanel
        {...buildProps({
          pullRefreshDistance: 18,
          pullRefreshLabel: "Release to refresh"
        })}
      />
    );

    const pullingIndicator = screen.getByText("Release to refresh").closest("div");
    expect(pullingIndicator).toHaveStyle({ maxHeight: "42px", opacity: "1" });

    rerender(
      <ScanResultsPanel
        {...buildProps({
          pullRefreshing: true,
          pullRefreshDistance: 0,
          pullRefreshLabel: "Refreshing scan results..."
        })}
      />
    );

    const refreshingIndicator = screen.getByText("Refreshing scan results...").closest("div");
    expect(refreshingIndicator).toHaveStyle({ maxHeight: "42px", opacity: "1" });
  });

  it("forwards touch start, move, end, and cancel events", () => {
    const props = buildProps();
    render(<ScanResultsPanel {...props} />);

    const region = screen.getByRole("region", { name: "Main scan results area" });

    fireEvent.touchStart(region, { changedTouches: [{ clientY: 30 }] });
    fireEvent.touchMove(region, { changedTouches: [{ clientY: 65 }] });
    fireEvent.touchEnd(region, { changedTouches: [{ clientY: 5 }] });
    fireEvent.touchCancel(region, { changedTouches: [{ clientY: 0 }] });

    expect(props.onTouchStart).toHaveBeenCalledTimes(1);
    expect(props.onTouchMove).toHaveBeenCalledTimes(1);
    expect(props.onTouchEnd).toHaveBeenCalledTimes(2);
  });
});
