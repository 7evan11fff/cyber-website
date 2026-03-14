"use client";

import { useEffect, useState } from "react";

const TOUR_DISMISSED_STORAGE_KEY = "security-header-checker:onboarding-tour-dismissed";

export function ScannerOnboardingTour({ onJumpToWorkbench }: { onJumpToWorkbench: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(TOUR_DISMISSED_STORAGE_KEY) !== "true");
    } catch {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setVisible(false);
        try {
          localStorage.setItem(TOUR_DISMISSED_STORAGE_KEY, "true");
        } catch {
          // Ignore storage issues in private mode.
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible]);

  function dismissTour() {
    setVisible(false);
    try {
      localStorage.setItem(TOUR_DISMISSED_STORAGE_KEY, "true");
    } catch {
      // Ignore storage issues in private mode.
    }
  }

  if (!visible) {
    return null;
  }

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="scanner-tour-title"
      aria-describedby="scanner-tour-description"
      className="mb-6 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 shadow-lg shadow-slate-950/40 sm:p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">Quick tour</p>
      <h2 id="scanner-tour-title" className="mt-2 text-lg font-semibold text-slate-100">
        First time here? Start in under 30 seconds
      </h2>
      <p id="scanner-tour-description" className="mt-2 text-sm text-slate-300">
        1) Enter a site URL, 2) run a scan, and 3) open quick fixes for missing headers.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            onJumpToWorkbench();
            dismissTour();
          }}
          className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-sky-400"
        >
          Start first scan
        </button>
        <button
          type="button"
          onClick={dismissTour}
          className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
        >
          Dismiss
        </button>
        <span className="text-xs text-slate-400">Tip: press Esc to dismiss.</span>
      </div>
    </section>
  );
}
