import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ScanHistoryCsvDownloadButton } from "@/app/components/ScanHistoryCsvDownloadButton";
import type { ScanHistoryEntry } from "@/lib/userData";

const { notifyMock } = vi.hoisted(() => ({ notifyMock: vi.fn() }));

vi.mock("@/app/components/ToastProvider", () => ({
  useToast: () => ({ notify: notifyMock })
}));

describe("ScanHistoryCsvDownloadButton", () => {
  beforeEach(() => {
    notifyMock.mockReset();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:scan-history")
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn()
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports csv and triggers success toast", () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const entries: ScanHistoryEntry[] = [
      {
        id: "history-1",
        url: "https://example.com",
        grade: "A",
        checkedAt: "2026-03-14T08:00:00.000Z",
        score: 20,
        maxScore: 22,
        headerStatuses: {
          "content-security-policy": "good"
        }
      }
    ];

    render(<ScanHistoryCsvDownloadButton entries={entries} fileNamePrefix="dashboard-scan-history" />);
    fireEvent.click(screen.getByRole("button", { name: /download scan history as csv/i }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith({ tone: "success", message: "Scan history exported as CSV." });
    expect(screen.getByRole("button", { name: /download scan history as csv/i })).toHaveTextContent("CSV downloaded");
  });
});
