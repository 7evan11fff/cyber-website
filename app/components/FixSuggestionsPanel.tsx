"use client";

import { useEffect, useMemo, useState } from "react";
import type { HeaderResult } from "@/lib/securityHeaders";
import { buildHeaderFixBundle } from "@/lib/headerGuidance";

type CopyTarget = "idle" | "nginx" | "apache" | "cloudflare" | "error";

function SnippetCard({
  title,
  snippet,
  onCopy,
  copied
}: {
  title: string;
  snippet: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <article className="rounded-lg border border-slate-800/90 bg-slate-900/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">{title}</h4>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-md border border-slate-700 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-52 overflow-auto rounded-md border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-200">
        <code>{snippet}</code>
      </pre>
    </article>
  );
}

export function FixSuggestionsPanel({ results }: { results: HeaderResult[] }) {
  const [open, setOpen] = useState(true);
  const [copyState, setCopyState] = useState<CopyTarget>("idle");

  const fixBundle = useMemo(() => buildHeaderFixBundle(results), [results]);

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
    <section className="mt-5 rounded-xl border border-slate-800/90 bg-slate-950/60">
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

              <div className="grid gap-3 lg:grid-cols-3">
                <SnippetCard
                  title="nginx"
                  snippet={fixBundle.nginxSnippet}
                  onCopy={() => void copySnippet("nginx", fixBundle.nginxSnippet)}
                  copied={copyState === "nginx"}
                />
                <SnippetCard
                  title="Apache"
                  snippet={fixBundle.apacheSnippet}
                  onCopy={() => void copySnippet("apache", fixBundle.apacheSnippet)}
                  copied={copyState === "apache"}
                />
                <SnippetCard
                  title="Cloudflare"
                  snippet={fixBundle.cloudflareSnippet}
                  onCopy={() => void copySnippet("cloudflare", fixBundle.cloudflareSnippet)}
                  copied={copyState === "cloudflare"}
                />
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
