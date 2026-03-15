"use client";

import type { FormEventHandler, MutableRefObject } from "react";

type ScanMode = "single" | "compare" | "bulk";

type ScanInputFormProps = {
  mode: ScanMode;
  loading: boolean;
  shortcutsOpen: boolean;
  sampleSites: readonly string[];
  maxBulkUrls: number;
  bulkUrlCount: number;
  singleUrl: string;
  compareUrlA: string;
  compareUrlB: string;
  bulkUrlsInput: string;
  singleUrlInputRef: MutableRefObject<HTMLInputElement | null>;
  compareUrlAInputRef: MutableRefObject<HTMLInputElement | null>;
  onModeChange: (mode: ScanMode) => void;
  onOpenShortcutsModal: () => void;
  onSingleSubmit: FormEventHandler<HTMLFormElement>;
  onCompareSubmit: FormEventHandler<HTMLFormElement>;
  onBulkSubmit: FormEventHandler<HTMLFormElement>;
  onSingleUrlChange: (value: string) => void;
  onCompareUrlAChange: (value: string) => void;
  onCompareUrlBChange: (value: string) => void;
  onBulkUrlsInputChange: (value: string) => void;
  onSampleClick: (site: string) => void;
};

export function ScanInputForm({
  mode,
  loading,
  shortcutsOpen,
  sampleSites,
  maxBulkUrls,
  bulkUrlCount,
  singleUrl,
  compareUrlA,
  compareUrlB,
  bulkUrlsInput,
  singleUrlInputRef,
  compareUrlAInputRef,
  onModeChange,
  onOpenShortcutsModal,
  onSingleSubmit,
  onCompareSubmit,
  onBulkSubmit,
  onSingleUrlChange,
  onCompareUrlAChange,
  onCompareUrlBChange,
  onBulkUrlsInputChange,
  onSampleClick
}: ScanInputFormProps) {
  return (
    <>
      <div className="mt-6 inline-flex w-full rounded-xl border border-slate-700 bg-slate-950/80 p-1 sm:w-auto">
        <button
          type="button"
          onClick={() => onModeChange("single")}
          aria-pressed={mode === "single"}
          aria-label="Switch to single scan mode"
          className={`flex-1 min-h-11 rounded-lg px-4 py-2.5 text-sm font-medium transition sm:flex-none ${
            mode === "single"
              ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-950/70"
              : "text-slate-300 hover:text-sky-200"
          }`}
        >
          Single Scan
        </button>
        <button
          type="button"
          onClick={() => onModeChange("compare")}
          aria-pressed={mode === "compare"}
          aria-label="Switch to compare mode"
          className={`flex-1 min-h-11 rounded-lg px-4 py-2.5 text-sm font-medium transition sm:flex-none ${
            mode === "compare"
              ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-950/70"
              : "text-slate-300 hover:text-sky-200"
          }`}
        >
          Compare
        </button>
        <button
          type="button"
          onClick={() => onModeChange("bulk")}
          aria-pressed={mode === "bulk"}
          aria-label="Switch to bulk scan mode"
          className={`flex-1 min-h-11 rounded-lg px-4 py-2.5 text-sm font-medium transition sm:flex-none ${
            mode === "bulk"
              ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-950/70"
              : "text-slate-300 hover:text-sky-200"
          }`}
        >
          Bulk Scan
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <p>
          Shortcuts: <span className="text-slate-300">Cmd/Ctrl+Enter</span> scan,{" "}
          <span className="text-slate-300">Cmd/Ctrl+K</span> quick scan/focus URL,{" "}
          <span className="text-slate-300">1-6</span> jump headers, <span className="text-slate-300">Ctrl+P</span> PDF.
        </p>
        <button
          type="button"
          onClick={onOpenShortcutsModal}
          aria-haspopup="dialog"
          aria-expanded={shortcutsOpen}
          aria-controls="keyboard-shortcuts-modal"
          className="rounded-md border border-slate-700 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
        >
          Keyboard help (?)
        </button>
      </div>

      {mode === "single" ? (
        <>
          <form onSubmit={onSingleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="single-site-url" className="sr-only">
              Website URL to scan
            </label>
            <input
              id="single-site-url"
              ref={singleUrlInputRef}
              type="text"
              value={singleUrl}
              onChange={(event) => onSingleUrlChange(event.target.value)}
              placeholder="example.com or https://example.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-5 py-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              aria-describedby="single-scan-hint"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-sky-500 px-5 py-4 font-medium text-slate-950 transition hover:bg-sky-400 sm:w-auto disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {loading ? "Scanning..." : "Check"}
            </button>
          </form>
          <p id="single-scan-hint" className="mt-2 text-xs text-slate-500">
            Enter a domain or full URL and press Cmd/Ctrl+Enter to scan.
          </p>

          <div className="mt-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Try sample sites</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {sampleSites.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => onSampleClick(sample)}
                  disabled={loading}
                  className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-sm text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : mode === "compare" ? (
        <form onSubmit={onCompareSubmit} className="mt-6">
          <div className="grid gap-3 md:grid-cols-2">
            <label htmlFor="compare-site-a-url" className="sr-only">
              Site A URL
            </label>
            <input
              id="compare-site-a-url"
              ref={compareUrlAInputRef}
              type="text"
              value={compareUrlA}
              onChange={(event) => onCompareUrlAChange(event.target.value)}
              placeholder="Site A (example.com)"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-5 py-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              required
            />
            <label htmlFor="compare-site-b-url" className="sr-only">
              Site B URL
            </label>
            <input
              id="compare-site-b-url"
              type="text"
              value={compareUrlB}
              onChange={(event) => onCompareUrlBChange(event.target.value)}
              placeholder="Site B (example.org)"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-5 py-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-3 w-full rounded-xl bg-sky-500 px-5 py-4 font-medium text-slate-950 transition hover:bg-sky-400 sm:w-auto disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {loading ? "Comparing..." : "Compare Headers"}
          </button>
          <p className="mt-2 text-xs text-slate-500">Tip: enter two domains, then use Cmd/Ctrl+Enter to run comparison.</p>
        </form>
      ) : (
        <form onSubmit={onBulkSubmit} className="mt-6 space-y-3">
          <label htmlFor="bulk-scan-urls" className="sr-only">
            Website URLs for bulk scan
          </label>
          <textarea
            id="bulk-scan-urls"
            value={bulkUrlsInput}
            onChange={(event) => onBulkUrlsInputChange(event.target.value)}
            placeholder={"example.com\nhttps://mozilla.org\ncloudflare.com"}
            rows={8}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-5 py-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            aria-describedby="bulk-scan-hint"
            required
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p id="bulk-scan-hint" className="text-xs text-slate-500">
              Enter one URL per line (up to {maxBulkUrls}). {bulkUrlCount}/{maxBulkUrls} URLs added.
            </p>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {loading ? "Scanning..." : "Run Bulk Scan"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
