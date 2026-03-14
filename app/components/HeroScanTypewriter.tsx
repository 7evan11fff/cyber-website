"use client";

import { useEffect, useMemo, useState } from "react";

const TYPE_SPEED_MS = 92;
const DELETE_SPEED_MS = 46;
const HOLD_FULL_TEXT_MS = 2200;
const NEXT_DOMAIN_DELAY_MS = 240;
const GRADE_REVEAL_DELAY_MS = 780;
const SCORE_COUNT_DURATION_MS = 640;

type DemoOutcome = {
  grade: string;
  score: number;
  maxScore: number;
  summary: string;
};

const DEMO_OUTCOMES: DemoOutcome[] = [
  { grade: "A", score: 20, maxScore: 22, summary: "Strong baseline protections detected" },
  { grade: "B", score: 17, maxScore: 22, summary: "One policy could be tightened" },
  { grade: "A", score: 21, maxScore: 22, summary: "Excellent headers across core checks" },
  { grade: "C", score: 14, maxScore: 22, summary: "Missing headers found, quick fixes available" }
];

function gradeToneClass(grade: string): string {
  if (grade === "A") return "text-emerald-300";
  if (grade === "B") return "text-lime-300";
  if (grade === "C") return "text-amber-300";
  if (grade === "D") return "text-orange-300";
  return "text-rose-300";
}

type HeroScanTypewriterProps = {
  domains: string[];
};

export function HeroScanTypewriter({ domains }: HeroScanTypewriterProps) {
  const safeDomains = useMemo(() => (domains.length > 0 ? domains : ["example.com"]), [domains]);
  const [domainIndex, setDomainIndex] = useState(0);
  const [typedDomain, setTypedDomain] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [showGradeReveal, setShowGradeReveal] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);

  const activeDomain = useMemo(() => safeDomains[domainIndex % safeDomains.length] ?? "example.com", [domainIndex, safeDomains]);
  const activeOutcome = useMemo(() => DEMO_OUTCOMES[domainIndex % DEMO_OUTCOMES.length] ?? DEMO_OUTCOMES[0], [domainIndex]);
  const activeGradeClass = useMemo(() => gradeToneClass(activeOutcome.grade), [activeOutcome.grade]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setTypedDomain(safeDomains[0] ?? "example.com");
      setDeleting(false);
      setDomainIndex(0);
      return;
    }

    const reachedEnd = !deleting && typedDomain === activeDomain;
    const reachedStart = deleting && typedDomain.length === 0;

    let timeoutId: number;
    if (reachedEnd) {
      timeoutId = window.setTimeout(() => setDeleting(true), HOLD_FULL_TEXT_MS);
    } else if (reachedStart) {
      timeoutId = window.setTimeout(() => {
        setDeleting(false);
        setDomainIndex((current) => (current + 1) % safeDomains.length);
      }, NEXT_DOMAIN_DELAY_MS);
    } else {
      timeoutId = window.setTimeout(
        () => {
          const nextLength = deleting ? typedDomain.length - 1 : typedDomain.length + 1;
          setTypedDomain(activeDomain.slice(0, Math.max(0, nextLength)));
        },
        deleting ? DELETE_SPEED_MS : TYPE_SPEED_MS
      );
    }

    return () => window.clearTimeout(timeoutId);
  }, [activeDomain, deleting, reducedMotion, safeDomains, typedDomain]);

  useEffect(() => {
    if (typedDomain !== activeDomain || deleting) {
      setScanProgress(0);
      setShowGradeReveal(false);
      setDisplayScore(0);
    }
  }, [activeDomain, deleting, typedDomain]);

  useEffect(() => {
    if (typedDomain !== activeDomain || deleting) return;
    if (reducedMotion) {
      setScanProgress(100);
      setShowGradeReveal(true);
      return;
    }
    let progress = 10;
    setScanProgress(progress);
    const intervalId = window.setInterval(() => {
      progress = Math.min(100, progress + 10);
      setScanProgress(progress);
    }, 90);
    const revealId = window.setTimeout(() => setShowGradeReveal(true), GRADE_REVEAL_DELAY_MS);
    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(revealId);
    };
  }, [activeDomain, deleting, reducedMotion, typedDomain]);

  useEffect(() => {
    if (!showGradeReveal) {
      setDisplayScore(0);
      return;
    }
    if (reducedMotion) {
      setDisplayScore(activeOutcome.score);
      return;
    }
    let rafId = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const t = Math.min(elapsed / SCORE_COUNT_DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(activeOutcome.score * eased));
      if (t < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [activeOutcome.score, reducedMotion, showGradeReveal]);

  return (
    <aside className="motion-card rounded-2xl border border-slate-700/80 bg-slate-950/70 p-4 shadow-xl shadow-slate-950/70">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-sky-300">Live scan preview</p>
      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
        <p className="font-mono text-sm text-emerald-200">
          $ shc scan{" "}
          <span aria-live="polite" aria-atomic="true">
            {typedDomain || " "}
          </span>
          <span className="typewriter-caret ml-0.5 text-sky-200" aria-hidden="true">
            |
          </span>
        </p>
        <p className="mt-2 text-xs text-slate-400">
          {typedDomain === activeDomain && !deleting
            ? `Scanning ${activeDomain} for missing or weak header protections...`
            : `Preparing next scan for ${activeDomain}`}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-[width] duration-200 ease-out"
            style={{ width: `${Math.max(6, scanProgress)}%` }}
          />
        </div>
        <div className="mt-3 rounded-lg border border-slate-800/90 bg-slate-950/70 p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Security score demo</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-400">Current outcome</p>
              <p className="text-sm font-semibold text-slate-100">
                {showGradeReveal ? `${displayScore}/${activeOutcome.maxScore}` : "Analyzing..."}
              </p>
              <p className="mt-1 text-xs text-slate-400">{activeOutcome.summary}</p>
            </div>
            <span
              className={`inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border px-4 py-2 text-xl font-bold ${
                showGradeReveal
                  ? `grade-badge-in grade-badge-glow border-sky-500/40 bg-sky-500/10 ${activeGradeClass}`
                  : "border-slate-700 bg-slate-900 text-slate-500"
              }`}
              aria-live="polite"
              aria-atomic="true"
            >
              {showGradeReveal ? activeOutcome.grade : "--"}
            </span>
          </div>
        </div>
      </div>
      <ul className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
        <li className="rounded-lg border border-slate-800/90 bg-slate-900/70 px-2 py-1.5">DNS lookup</li>
        <li className="rounded-lg border border-slate-800/90 bg-slate-900/70 px-2 py-1.5">Header fetch</li>
        <li className="rounded-lg border border-slate-800/90 bg-slate-900/70 px-2 py-1.5">Grade scoring</li>
      </ul>
    </aside>
  );
}
