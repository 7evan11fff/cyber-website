import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { HEADER_GUIDANCE } from "@/lib/headerGuidance";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Security Headers Guide",
  description:
    "Understand each security header checked by Security Header Checker, why it matters, and how to configure safer defaults.",
  path: "/security-headers-guide"
});

export default function SecurityHeadersGuidePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />

      <section className="mb-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Learning center</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-100 sm:text-4xl">Security headers guide</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          This guide explains each header the scanner checks, the risk it helps reduce, and practical baseline
          values you can use as a starting point in production.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <h2 className="text-2xl font-semibold text-slate-100">How to use this page</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
          <li>Use the recommended baseline as a starting point, then adapt for your app architecture.</li>
          <li>Review common misconfigurations to avoid accidental regressions in deployments.</li>
          <li>Run a new scan after each change to verify your headers are served exactly as intended.</li>
        </ul>
      </section>

      <section className="mt-6 space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        {HEADER_GUIDANCE.map((item) => (
          <article key={item.key} className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{item.headerName}</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-100">{item.label}</h3>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-300">{item.purpose}</p>
            <p className="mt-3 text-xs text-slate-400">
              Recommended baseline:
              <code className="ml-2 rounded bg-slate-900 px-1.5 py-0.5 text-slate-200">{item.recommendedValue}</code>
            </p>
            <h4 className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-slate-400">
              Common misconfigurations
            </h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
              {item.commonMisconfigurations.map((misconfiguration) => (
                <li key={misconfiguration}>{misconfiguration}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <h2 className="text-2xl font-semibold text-slate-100">CORS configuration guidance</h2>
        <p className="mt-2 text-sm text-slate-300">
          CORS is evaluated separately from core security headers. It controls which origins can access your API from a
          browser context. Overly broad settings can expose authenticated endpoints across untrusted origins.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">Recommended baseline</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
              <li>
                Set <code className="rounded bg-slate-900 px-1 py-0.5 text-slate-200">Access-Control-Allow-Origin</code>{" "}
                to explicit trusted origins (no wildcard).
              </li>
              <li>
                Keep methods and request headers minimal for each endpoint.
              </li>
              <li>
                Enable credentials only when required, and only with explicit origin allowlists.
              </li>
            </ul>
          </article>
          <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">Critical misconfiguration</h3>
            <p className="mt-2 text-sm text-slate-300">
              <code className="rounded bg-slate-900 px-1 py-0.5 text-slate-200">Access-Control-Allow-Origin: *</code>{" "}
              combined with{" "}
              <code className="rounded bg-slate-900 px-1 py-0.5 text-slate-200">
                Access-Control-Allow-Credentials: true
              </code>{" "}
              is treated as a critical finding.
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Use explicit origin allowlists and include <code className="rounded bg-slate-900 px-1 py-0.5 text-slate-200">Vary: Origin</code>{" "}
              when dynamically selecting allowed origins.
            </p>
          </article>
        </div>
      </section>

      <p className="mt-6 text-sm text-slate-300">
        Want to verify your live headers?{" "}
        <Link href="/" className="text-sky-300 transition hover:text-sky-200">
          Run a security header scan
        </Link>
        {" "}or explore the{" "}
        <Link href="/docs" className="text-sky-300 transition hover:text-sky-200">
          API docs
        </Link>
        .
      </p>

      <SiteFooter className="mt-10" />
    </main>
  );
}
