import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { setThemeMock, useThemeMock } = vi.hoisted(() => ({
  setThemeMock: vi.fn(),
  useThemeMock: vi.fn()
}));

vi.mock("next-themes", () => ({
  useTheme: useThemeMock
}));

import { ThemeToggle } from "@/app/components/ThemeToggle";

describe("ThemeToggle", () => {
  it("renders theme options and marks the active theme", async () => {
    useThemeMock.mockReturnValue({
      setTheme: setThemeMock,
      theme: "light"
    });

    render(<ThemeToggle />);

    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to system theme" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Switch to light theme" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    });
  });

  it("calls setTheme when an option is clicked", () => {
    useThemeMock.mockReturnValue({
      setTheme: setThemeMock,
      theme: "dark"
    });

    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to system theme" }));

    expect(setThemeMock).toHaveBeenCalledWith("system");
  });
});
