"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { buildQuickFixCatalog, normalizeFixPlatform, type FixPlatformId } from "@/lib/platformFixes";

type CopyState = "idle" | FixPlatformId | "error";

export function QuickFixesPageClient() {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const searchParams = useSearchParams();
  const selectedPlatform = normalizeFixPlatform(searchParams.get("platform"));
  const catalog = useMemo(() => buildQuickFixCatalog(), []);

  const ordered = useMemo(() => {
    if (!selectedPlatform) return catalog;
    return [...catalog].sort((a, b) => {
      if (a.id === selectedPlatform) return -1;
      if (b.id === selectedPlatform) return 1;
      return 0;
    });
  }, [catalog, selectedPlatform]);

  async function copySnippet(platform: FixPlatformId, snippet: string) {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopyState(platform);
    } catch {
      setCopyState("error");
    } finally {
      window.setTimeout(() => setCopyState("idle"), 2200);
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/60">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Quick Fixes by platform</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Copy one of these starter configs and adjust policy values to match your app. Each snippet includes the
          recommended baseline for all supported security headers.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {catalog.map((platform) => {
            const isActive = platform.id === selectedPlatform;
            return (
              <Link
                key={platform.id}
                href={`/fixes?platform=${encodeURIComponent(platform.id)}#snippet-${platform.id}`}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  isActive
                    ? "border-sky-500/70 bg-sky-500/20 text-sky-100"
                    : "border-slate-700 bg-slate-950/70 text-slate-300 hover:border-sky-500/60 hover:text-sky-200"
                }`}
              >
                {platform.title}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {ordered.map((item) => {
          const highlighted = item.id === selectedPlatform;
          return (
            <article
              id={`snippet-${item.id}`}
              key={item.id}
              className={`rounded-2xl border p-5 shadow-xl ${
                highlighted
                  ? "border-sky-500/50 bg-sky-500/10 shadow-sky-950/40"
                  : "border-slate-800/90 bg-slate-900/70 shadow-slate-950/60"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-300">{item.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void copySnippet(item.id, item.snippet)}
                  className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
                >
                  {copyState === item.id ? "Copied" : "Copy snippet"}
                </button>
              </div>
              <pre className="mt-4 max-h-[26rem] overflow-auto rounded-xl border border-slate-800 bg-slate-950/85 p-4 text-xs text-slate-200">
                <code>{item.snippet}</code>
              </pre>
            </article>
          );
        })}
      </div>

      {copyState === "error" && <p className="text-sm text-rose-300">Clipboard unavailable. Please copy manually.</p>}
    </section>
  );
}
