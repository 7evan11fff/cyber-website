"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastTone = "success" | "error" | "info";

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
  durationMs: number;
};

type ToastInput = {
  message: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ToastContextValue = {
  notify: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<ToastTone, string> = {
  success: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
  error: "border-rose-500/50 bg-rose-500/15 text-rose-100",
  info: "border-sky-500/40 bg-sky-500/15 text-sky-100"
};

const toneProgressStyles: Record<ToastTone, string> = {
  success: "bg-emerald-300/70",
  error: "bg-rose-300/75",
  info: "bg-sky-300/75"
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback(({ message, tone = "info", durationMs = 2800 }: ToastInput) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, message, tone, durationMs }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, durationMs);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      notify
    }),
    [notify]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[70] flex w-full max-w-sm flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            aria-live={toast.tone === "error" ? "assertive" : "polite"}
            aria-atomic="true"
            className={`toast-item overflow-hidden rounded-lg border px-4 py-3 text-sm shadow-xl shadow-slate-950/70 backdrop-blur ${toneStyles[toast.tone]}`}
          >
            <p>{toast.message}</p>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-900/60">
              <span
                className={`toast-progress block h-full rounded-full ${toneProgressStyles[toast.tone]}`}
                style={{ animationDuration: `${toast.durationMs}ms` }}
              />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider.");
  }
  return context;
}
