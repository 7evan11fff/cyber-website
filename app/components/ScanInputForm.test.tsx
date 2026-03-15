import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScanInputForm } from "@/app/components/ScanInputForm";

function buildProps(overrides: Partial<ComponentProps<typeof ScanInputForm>> = {}): ComponentProps<typeof ScanInputForm> {
  return {
    mode: "single",
    loading: false,
    shortcutsOpen: false,
    sampleSites: ["example.com", "mozilla.org"],
    maxBulkUrls: 10,
    bulkUrlCount: 0,
    singleUrl: "",
    compareUrlA: "",
    compareUrlB: "",
    bulkUrlsInput: "",
    singleUrlInputRef: { current: null },
    compareUrlAInputRef: { current: null },
    onModeChange: vi.fn(),
    onOpenShortcutsModal: vi.fn(),
    onSingleSubmit: vi.fn((event) => event.preventDefault()),
    onCompareSubmit: vi.fn((event) => event.preventDefault()),
    onBulkSubmit: vi.fn((event) => event.preventDefault()),
    onSingleUrlChange: vi.fn(),
    onCompareUrlAChange: vi.fn(),
    onCompareUrlBChange: vi.fn(),
    onBulkUrlsInputChange: vi.fn(),
    onSampleClick: vi.fn(),
    ...overrides
  };
}

describe("ScanInputForm", () => {
  it("switches modes and reports aria pressed state", () => {
    const props = buildProps({ mode: "single" });
    render(<ScanInputForm {...props} />);

    const singleButton = screen.getByRole("button", { name: "Switch to single scan mode" });
    const compareButton = screen.getByRole("button", { name: "Switch to compare mode" });
    const bulkButton = screen.getByRole("button", { name: "Switch to bulk scan mode" });

    expect(singleButton).toHaveAttribute("aria-pressed", "true");
    expect(compareButton).toHaveAttribute("aria-pressed", "false");
    expect(bulkButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(compareButton);
    fireEvent.click(bulkButton);

    expect(props.onModeChange).toHaveBeenNthCalledWith(1, "compare");
    expect(props.onModeChange).toHaveBeenNthCalledWith(2, "bulk");
  });

  it("submits single mode and forwards domain/full URL input values", () => {
    const props = buildProps({ mode: "single" });
    render(<ScanInputForm {...props} />);

    const urlInput = screen.getByLabelText("Website URL to scan");
    expect(urlInput).toBeRequired();
    expect(urlInput).toHaveAttribute("aria-describedby", "single-scan-hint");

    fireEvent.change(urlInput, { target: { value: "example.com" } });
    fireEvent.change(urlInput, { target: { value: "https://example.com" } });

    expect(props.onSingleUrlChange).toHaveBeenNthCalledWith(1, "example.com");
    expect(props.onSingleUrlChange).toHaveBeenNthCalledWith(2, "https://example.com");

    fireEvent.submit(urlInput.closest("form") as HTMLFormElement);
    expect(props.onSingleSubmit).toHaveBeenCalledTimes(1);
  });

  it("renders keyboard shortcut hints and opens keyboard help", () => {
    const props = buildProps({ shortcutsOpen: false });
    render(<ScanInputForm {...props} />);

    expect(screen.getAllByText(/Cmd\/Ctrl\+Enter/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cmd\/Ctrl\+K/)).toBeInTheDocument();

    const keyboardHelpButton = screen.getByRole("button", { name: "Keyboard help (?)" });
    expect(keyboardHelpButton).toHaveAttribute("aria-haspopup", "dialog");
    expect(keyboardHelpButton).toHaveAttribute("aria-controls", "keyboard-shortcuts-modal");
    expect(keyboardHelpButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(keyboardHelpButton);
    expect(props.onOpenShortcutsModal).toHaveBeenCalledTimes(1);
  });

  it("renders compare mode fields with required validation and submits", () => {
    const props = buildProps({
      mode: "compare",
      compareUrlA: "old-a.test",
      compareUrlB: "old-b.test"
    });
    render(<ScanInputForm {...props} />);

    const siteAInput = screen.getByLabelText("Site A URL");
    const siteBInput = screen.getByLabelText("Site B URL");

    expect(siteAInput).toBeRequired();
    expect(siteBInput).toBeRequired();

    fireEvent.change(siteAInput, { target: { value: "site-a.example" } });
    fireEvent.change(siteBInput, { target: { value: "https://site-b.example" } });

    expect(props.onCompareUrlAChange).toHaveBeenCalledWith("site-a.example");
    expect(props.onCompareUrlBChange).toHaveBeenCalledWith("https://site-b.example");

    fireEvent.submit(siteAInput.closest("form") as HTMLFormElement);
    expect(props.onCompareSubmit).toHaveBeenCalledTimes(1);
  });

  it("renders bulk mode textarea, URL counter hint, and submits", () => {
    const props = buildProps({
      mode: "bulk",
      maxBulkUrls: 10,
      bulkUrlCount: 2,
      bulkUrlsInput: "example.com\nmozilla.org"
    });
    render(<ScanInputForm {...props} />);

    const textarea = screen.getByLabelText("Website URLs for bulk scan");
    expect(textarea).toBeRequired();
    expect(textarea).toHaveAttribute("aria-describedby", "bulk-scan-hint");
    expect(screen.getByText("Enter one URL per line (up to 10). 2/10 URLs added.")).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: "example.com\nw3.org" } });
    expect(props.onBulkUrlsInputChange).toHaveBeenCalledWith("example.com\nw3.org");

    fireEvent.submit(textarea.closest("form") as HTMLFormElement);
    expect(props.onBulkSubmit).toHaveBeenCalledTimes(1);
  });

  it("fires sample site click handlers and disables action buttons while loading", () => {
    const singleModeProps = buildProps({
      mode: "single",
      sampleSites: ["example.com", "mozilla.org"]
    });
    const { rerender } = render(<ScanInputForm {...singleModeProps} />);

    fireEvent.click(screen.getByRole("button", { name: "example.com" }));
    expect(singleModeProps.onSampleClick).toHaveBeenCalledWith("example.com");

    rerender(<ScanInputForm {...buildProps({ mode: "single", loading: true, sampleSites: ["example.com"] })} />);

    expect(screen.getByRole("button", { name: "Scanning..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "example.com" })).toBeDisabled();
  });
});
