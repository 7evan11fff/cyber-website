"use client";

import { useEffect, useMemo, useState } from "react";

const TYPE_SPEED_MS = 92;
const DELETE_SPEED_MS = 46;
const HOLD_FULL_TEXT_MS = 1100;
const NEXT_DOMAIN_DELAY_MS = 240;

type HeroScanTypewriterProps = {
  domains: string[];
};

export function HeroScanTypewriter({ domains }: HeroScanTypewriterProps) {
  const safeDomains = useMemo(() => (domains.length > 0 ? domains : ["example.com"]), [domains]);
  const [domainIndex, setDomainIndex] = useState(0);
  const [typedDomain, setTypedDomain] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const activeDomain = useMemo(() => safeDomains[domainIndex % safeDomains.length] ?? "example.com", [domainIndex, safeDomains]);

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
        <p className="mt-2 text-xs text-slate-400">Scanning {activeDomain} for missing or weak header protections.</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="hero-scan-progress h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400" />
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
