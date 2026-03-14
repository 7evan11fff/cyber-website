"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";

type BadgeStyle = "flat" | "plastic";
type BadgeFormat = "svg" | "png";
type BadgeTheme = "default" | "slate" | "light";
type CopyState = "idle" | "copied-markdown" | "copied-html" | "error";

function normalizeDomain(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function BadgePageClient() {
  const [domainInput, setDomainInput] = useState("example.com");
  const [activeDomain, setActiveDomain] = useState("example.com");
  const [style, setStyle] = useState<BadgeStyle>("flat");
  const [theme, setTheme] = useState<BadgeTheme>("default");
  const [label, setLabel] = useState("security headers");
  const [format, setFormat] = useState<BadgeFormat>("svg");
  const [origin, setOrigin] = useState("");
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOrigin(window.location.origin);
  }, []);

  const normalizedDomain = useMemo(() => normalizeDomain(activeDomain), [activeDomain]);
  const hasValidDomain = normalizedDomain.length > 0;

  const encodedDomain = useMemo(() => encodeURIComponent(normalizedDomain || "example.com"), [normalizedDomain]);
  const badgeLabel = label.trim() || "security headers";
  const svgQuery = new URLSearchParams({
    style,
    theme,
    label: badgeLabel
  });
  const svgPath = `/badge/${encodedDomain}?${svgQuery.toString()}`;
  const pngPath = `/api/badge/${encodedDomain}/png?style=${style === "plastic" ? "flat" : style}`;
  const activePath = format === "svg" ? svgPath : pngPath;
  const absoluteActivePath = origin ? `${origin}${activePath}` : activePath;

  const markdownCode = hasValidDomain
    ? `![Security headers grade badge for ${normalizedDomain}](${absoluteActivePath})`
    : "";
  const htmlCode = hasValidDomain
    ? `<img src="${absoluteActivePath}" alt="Security headers grade badge for ${normalizedDomain}" />`
    : "";

  async function onCopy(type: "markdown" | "html") {
    const value = type === "markdown" ? markdownCode : htmlCode;
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopyState(type === "markdown" ? "copied-markdown" : "copied-html");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextDomain = normalizeDomain(domainInput);
    if (!nextDomain) return;
    setActiveDomain(nextDomain);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />

      <section className="mb-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Embeddable badges</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100 sm:text-4xl">Generate a security grade badge</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Create Shields-style badges for your domain and embed them in docs, README files, or status pages. Choose
          SVG or PNG output and copy ready-to-use code snippets.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="badge-domain" className="mb-1 block text-xs uppercase tracking-[0.14em] text-slate-400">
              Domain
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="badge-domain"
                type="text"
                value={domainInput}
                onChange={(event) => setDomainInput(event.target.value)}
                placeholder="example.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                required
              />
              <button
                type="submit"
                className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
              >
                Generate badge
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950/80 p-1">
              <button
                type="button"
                onClick={() => setStyle("flat")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  style === "flat" ? "bg-sky-500 text-slate-950" : "text-slate-300 hover:text-sky-200"
                }`}
              >
                Flat
              </button>
              <button
                type="button"
                onClick={() => setStyle("plastic")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  style === "plastic" ? "bg-sky-500 text-slate-950" : "text-slate-300 hover:text-sky-200"
                }`}
              >
                Plastic
              </button>
            </div>

            <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950/80 p-1">
              <button
                type="button"
                onClick={() => setFormat("svg")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  format === "svg" ? "bg-sky-500 text-slate-950" : "text-slate-300 hover:text-sky-200"
                }`}
              >
                SVG
              </button>
              <button
                type="button"
                onClick={() => setFormat("png")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  format === "png" ? "bg-sky-500 text-slate-950" : "text-slate-300 hover:text-sky-200"
                }`}
              >
                PNG
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-400">
              Badge label
              <input
                type="text"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                maxLength={42}
              />
            </label>
            <label className="text-xs text-slate-400">
              Theme
              <select
                value={theme}
                onChange={(event) => setTheme(event.target.value as BadgeTheme)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
              >
                <option value="default">Default</option>
                <option value="slate">Slate</option>
                <option value="light">Light</option>
              </select>
            </label>
          </div>
        </form>

        <div className="mt-6 rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Preview</p>
          <div className="mt-3 flex min-h-[56px] items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-4">
            {hasValidDomain ? (
              <Image
                src={activePath}
                alt={`Security headers grade badge for ${normalizedDomain}`}
                width={220}
                height={20}
                loading="lazy"
                decoding="async"
                unoptimized
                className="h-auto max-w-full"
              />
            ) : (
              <p className="text-xs text-rose-300">Enter a valid domain to generate a badge.</p>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs text-slate-400">Badge URL</p>
            <input
              type="text"
              readOnly
              value={absoluteActivePath}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
            />
          </div>
          <div>
            <p className="text-xs text-slate-400">Markdown snippet</p>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                readOnly
                value={markdownCode}
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
              />
              <button
                type="button"
                onClick={() => void onCopy("markdown")}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
              >
                Copy
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400">HTML snippet</p>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                readOnly
                value={htmlCode}
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
              />
              <button
                type="button"
                onClick={() => void onCopy("html")}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        {copyState === "copied-markdown" && <p className="mt-3 text-xs text-emerald-300">Markdown copied.</p>}
        {copyState === "copied-html" && <p className="mt-3 text-xs text-emerald-300">HTML copied.</p>}
        {copyState === "error" && <p className="mt-3 text-xs text-rose-300">Clipboard unavailable. Copy manually.</p>}
      </section>

      <SiteFooter className="mt-10" />
    </main>
  );
}
