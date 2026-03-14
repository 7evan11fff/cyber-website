import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnimatedGradeCircle } from "@/app/components/AnimatedGradeCircle";

function installMatchMediaMock(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
  });
}

describe("AnimatedGradeCircle", () => {
  it("renders the grade and updates score text", async () => {
    installMatchMediaMock(true);

    render(<AnimatedGradeCircle score={8} total={10} grade="A" gradeClassName="text-emerald-300" />);

    expect(screen.getByText("A")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("8/10")).toBeInTheDocument();
    });
    expect(screen.getByText("Grade A with score 8 out of 10")).toBeInTheDocument();
  });

  it("clamps score values to valid range", async () => {
    installMatchMediaMock(true);

    render(<AnimatedGradeCircle score={120} total={10} grade="A" gradeClassName="text-emerald-300" />);

    await waitFor(() => {
      expect(screen.getByText("10/10")).toBeInTheDocument();
    });
  });
});
