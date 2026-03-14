"use client";

import { useEffect } from "react";

type ConfettiPreset = "grade" | "contact";

type ConfettiLauncherProps = {
  triggerKey: number;
  preset: ConfettiPreset;
};

export function ConfettiLauncher({ triggerKey, preset }: ConfettiLauncherProps) {
  useEffect(() => {
    if (triggerKey === 0) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let followUpBurstTimer: number | null = null;
    void import("canvas-confetti")
      .then(({ default: confetti }) => {
        if (cancelled) return;
        if (preset === "grade") {
          confetti({
            particleCount: 36,
            spread: 56,
            startVelocity: 26,
            origin: { y: 0.72 },
            scalar: 0.72,
            gravity: 1,
            colors: ["#7dd3fc", "#34d399", "#22d3ee", "#a7f3d0"]
          });
          followUpBurstTimer = window.setTimeout(() => {
            confetti({
              particleCount: 24,
              spread: 44,
              startVelocity: 22,
              origin: { y: 0.74 },
              scalar: 0.66,
              gravity: 1.05,
              colors: ["#38bdf8", "#4ade80", "#5eead4"]
            });
          }, 180);
        } else {
          confetti({
            particleCount: 50,
            spread: 60,
            startVelocity: 28,
            origin: { y: 0.75 },
            scalar: 0.75,
            colors: ["#7dd3fc", "#34d399", "#22d3ee", "#a7f3d0"]
          });
          followUpBurstTimer = window.setTimeout(() => {
            confetti({
              particleCount: 32,
              spread: 45,
              startVelocity: 24,
              origin: { y: 0.78 },
              scalar: 0.68,
              colors: ["#38bdf8", "#5eead4", "#4ade80"]
            });
          }, 180);
        }
      })
      .catch(() => {
        // Confetti is cosmetic only; ignore failures.
      });

    return () => {
      cancelled = true;
      if (followUpBurstTimer !== null) {
        window.clearTimeout(followUpBurstTimer);
      }
    };
  }, [preset, triggerKey]);

  return null;
}
