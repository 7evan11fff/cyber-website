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
  it("renders a light-switch action when dark is active", async () => {
    useThemeMock.mockReturnValue({
      setTheme: setThemeMock,
      resolvedTheme: "dark"
    });

    render(<ThemeToggle />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
    });
  });

  it("switches from dark to light when clicked", () => {
    useThemeMock.mockReturnValue({
      setTheme: setThemeMock,
      resolvedTheme: "dark"
    });

    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));

    expect(setThemeMock).toHaveBeenCalledWith("light");
  });

  it("switches from light to dark when clicked", () => {
    useThemeMock.mockReturnValue({
      setTheme: setThemeMock,
      resolvedTheme: "light"
    });

    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));

    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });
});
