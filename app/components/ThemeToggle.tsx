"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme !== "light" : true;

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="pressable inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
    >
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full transition ${
          isDark ? "bg-slate-900 text-amber-300" : "bg-sky-500/15 text-sky-600"
        }`}
        aria-hidden="true"
      >
        {isDark ? (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
            <path d="M12 4.25a.75.75 0 0 1 .75.75V7a.75.75 0 0 1-1.5 0V5a.75.75 0 0 1 .75-.75Zm0 12a.75.75 0 0 1 .75.75V19a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .75-.75Zm7.75-4.75a.75.75 0 0 1 0 1.5H17.5a.75.75 0 0 1 0-1.5h2.25Zm-12.5 0a.75.75 0 0 1 0 1.5H5a.75.75 0 0 1 0-1.5h2.25Zm8.18-4.93a.75.75 0 0 1 1.06 1.06l-1.6 1.6a.75.75 0 1 1-1.06-1.06l1.6-1.6Zm-6.96 6.96a.75.75 0 0 1 1.06 1.06l-1.6 1.6a.75.75 0 1 1-1.06-1.06l1.6-1.6Zm8.02 2.66a.75.75 0 0 1 0 1.06.75.75 0 0 1-1.06 0l-1.6-1.6a.75.75 0 1 1 1.06-1.06l1.6 1.6Zm-6.96-6.96a.75.75 0 0 1 0 1.06.75.75 0 0 1-1.06 0l-1.6-1.6a.75.75 0 1 1 1.06-1.06l1.6 1.6ZM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
            <path d="M13.75 3a.75.75 0 0 1 .7 1.02 8.25 8.25 0 1 0 10.53 10.53.75.75 0 0 1 1.02.7A9.75 9.75 0 1 1 13.05 2.3.75.75 0 0 1 13.75 3Z" />
          </svg>
        )}
      </span>
      <span>{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
