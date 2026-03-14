"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const THEME_OPTIONS = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" }
] as const;

type ThemeValue = (typeof THEME_OPTIONS)[number]["value"];

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = (mounted && theme ? theme : "dark") as ThemeValue;

  return (
    <div className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-950/80 p-1" role="group" aria-label="Theme selection">
      {THEME_OPTIONS.map((option) => {
        const active = currentTheme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            aria-label={`Switch to ${option.label.toLowerCase()} theme`}
            aria-pressed={active}
            className={`rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
              active
                ? "bg-sky-500/25 text-sky-100"
                : "text-slate-300 hover:bg-slate-900 hover:text-sky-200"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
