"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FrameworkInfo } from "@/lib/frameworkDetection";
import {
  buildPlatformFixSuggestions,
  getSuggestedPlatformFromFramework,
  type FixPlatformId,
  type PlatformFixSnippet
} from "@/lib/platformFixes";
import type { HeaderResult } from "@/lib/securityHeaders";

type CopyTarget = "idle" | FixPlatformId | "error";

function SnippetCard({
  item,
  onCopy,
  copied,
  highlighted
}: {
  item: PlatformFixSnippet;
  onCopy: () => void;
  copied: boolean;
  highlighted: boolean;
}) {
  return (
    <article
      className={`motion-card rounded-lg border p-3 ${
        highlighted
          ? "border-sky-500/50 bg-sky-500/10 shadow-lg shadow-sky-950/30"
          : "border-slate-800/90 bg-slate-900/70"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">{item.title}</h4>
          {highlighted && (
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-sky-200">Recommended</p>
          )}
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-md border border-slate-700 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mb-2 text-xs text-slate-400">{item.description}</p>
      <pre className="max-h-52 overflow-auto rounded-md border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-200">
        <code>{item.snippet}</code>
      </pre>
    </article>
  );
}

export function FixSuggestionsPanel({
  results,
  framework
}: {
  results: HeaderResult[];
  framework?: FrameworkInfo;
}) {
  const [open, setOpen] = useState(true);
  const [copyState, setCopyState] = useState<CopyTarget>("idle");

  const fixBundle = useMemo(() => buildPlatformFixSuggestions(results), [results]);
  const suggestedPlatform = useMemo(
    () => getSuggestedPlatformFromFramework(framework?.detected),
    [framework?.detected]
  );
  const orderedSnippets = useMemo(() => {
    if (!suggestedPlatform) return fixBundle.snippets;
    return [...fixBundle.snippets].sort((a, b) => {
      if (a.id === suggestedPlatform) return -1;
      if (b.id === suggestedPlatform) return 1;
      return 0;
    });
  }, [fixBundle.snippets, suggestedPlatform]);
  const suggestedFixesHref = useMemo(() => {
    if (!suggestedPlatform) return "/fixes";
    return `/fixes?platform=${encodeURIComponent(suggestedPlatform)}`;
  }, [suggestedPlatform]);

  useEffect(() => {
    setOpen(true);
    setCopyState("idle");
  }, [results]);

  async function copySnippet(target: Exclude<CopyTarget, "idle" | "error">, snippet: string) {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopyState(target);
    } catch {
      setCopyState("error");
    } finally {
      window.setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  return (
    <section className="motion-card mt-5 rounded-xl border border-slate-800/90 bg-slate-950/60">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="header-fix-panel"
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-900/60"
      >
        <span className="text-sm font-medium text-slate-100">How to fix</span>
        <span className="text-xs uppercase tracking-[0.14em] text-slate-400">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div id="header-fix-panel" className="space-y-4 border-t border-slate-800/90 px-4 py-4">
          {fixBundle.headers.length === 0 ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              Great news - all checked security headers are already configured strongly.
            </p>
          ) : (
            <>
              {framework?.detected && suggestedPlatform && (
                <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
                  Detected <span className="font-semibold">{framework.detected.label}</span>. Start with the
                  recommended snippet below or open the{" "}
                  <Link href={suggestedFixesHref} className="font-semibold text-sky-200 underline-offset-2 hover:underline">
                    Quick Fixes page
                  </Link>
                  .
                </p>
              )}
              <div>
                <p className="text-sm text-slate-300">
                  Copy and apply these snippets for headers that are missing or weak:
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {fixBundle.headers.map((item) => (
                    <li
                      key={item.key}
                      className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs text-sky-100"
                    >
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {orderedSnippets.map((snippet) => (
                  <SnippetCard
                    key={snippet.id}
                    item={snippet}
                    onCopy={() => void copySnippet(snippet.id, snippet.snippet)}
                    copied={copyState === snippet.id}
                    highlighted={snippet.id === suggestedPlatform}
                  />
                ))}
              </div>
              {copyState === "error" && (
                <p className="text-xs text-rose-300">Clipboard unavailable. Please copy manually.</p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
