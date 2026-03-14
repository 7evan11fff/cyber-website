"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const INSTALL_DISMISS_STORAGE_KEY = "security-header-checker:pwa-install-dismissed-at";
const INSTALL_DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const SCAN_COMPLETED_STORAGE_KEY = "security-header-checker:pwa-install-eligible";
const SCAN_COMPLETED_EVENT = "shc:scan-completed";

function isStandaloneDisplayMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 1024px)").matches;
}

function wasDismissedRecently() {
  try {
    const value = localStorage.getItem(INSTALL_DISMISS_STORAGE_KEY);
    if (!value) return false;
    const dismissedAt = Number(value);
    if (!Number.isFinite(dismissedAt)) return false;
    return Date.now() - dismissedAt < INSTALL_DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function markInstallPromptDismissed() {
  try {
    localStorage.setItem(INSTALL_DISMISS_STORAGE_KEY, String(Date.now()));
  } catch {
    // Ignore storage issues.
  }
}

function hasCompletedAtLeastOneScan() {
  try {
    return localStorage.getItem(SCAN_COMPLETED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [scanCompleted, setScanCompleted] = useState(false);

  const canShowBanner = useMemo(() => {
    if (!deferredPrompt) return false;
    if (typeof window === "undefined") return false;
    if (isStandaloneDisplayMode()) return false;
    if (!isMobileViewport()) return false;
    if (!scanCompleted) return false;
    if (wasDismissedRecently()) return false;
    return true;
  }, [deferredPrompt, scanCompleted]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setScanCompleted(hasCompletedAtLeastOneScan());

    const onBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setDeferredPrompt(installEvent);
    };
    const onScanCompleted = () => {
      setScanCompleted(true);
    };

    const onAppInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
      try {
        localStorage.removeItem(INSTALL_DISMISS_STORAGE_KEY);
      } catch {
        // Ignore storage issues.
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener(SCAN_COMPLETED_EVENT, onScanCompleted);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener(SCAN_COMPLETED_EVENT, onScanCompleted);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  useEffect(() => {
    setVisible(canShowBanner);
  }, [canShowBanner]);

  const onDismiss = useCallback(() => {
    markInstallPromptDismissed();
    setVisible(false);
  }, []);

  const onInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome !== "accepted") {
        markInstallPromptDismissed();
      }
      setVisible(false);
      setDeferredPrompt(null);
    } finally {
      setInstalling(false);
    }
  }, [deferredPrompt]);

  if (!visible) return null;

  return (
    <aside
      role="region"
      aria-label="Install Security Header Checker"
      className="fixed inset-x-3 bottom-3 z-[120] rounded-2xl border border-sky-500/40 bg-slate-900/95 p-3 shadow-2xl shadow-slate-950/80 backdrop-blur sm:left-auto sm:right-4 sm:max-w-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">Install app</p>
      <p className="mt-1 text-sm text-slate-200">
        Add Security Header Checker to your home screen for faster access and offline scan history.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onInstall}
          disabled={installing}
          className="min-h-11 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {installing ? "Installing..." : "Install"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-11 rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
        >
          Not now
        </button>
      </div>
    </aside>
  );
}
