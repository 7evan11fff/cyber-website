import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Suspense } from "react";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { buildPageMetadata } from "@/lib/seo";

const QuickFixesPageClient = dynamic(
  () => import("@/app/components/QuickFixesPageClient").then((module) => module.QuickFixesPageClient),
  {
    suspense: true
  }
);

export const metadata: Metadata = buildPageMetadata({
  title: "Quick Fixes",
  description:
    "Copy production-ready security header snippets for Express.js, Next.js, Nginx, Apache, and Cloudflare Workers.",
  path: "/fixes"
});

export default function FixesPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />

      <section className="mb-6 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Quick fixes</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100 sm:text-3xl">
          Copy-paste security header configs
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Use these platform snippets to ship baseline protection quickly. Start with the snippet that matches your
          stack, deploy, and run a fresh scan to verify your grade improved.
        </p>
        <p className="mt-3 text-xs text-slate-400">
          Tip: run a scan first to auto-detect your stack and jump directly to the recommended snippet.
        </p>
      </section>

      <Suspense
        fallback={
          <section className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-6" aria-hidden="true">
            <div className="skeleton-shimmer h-6 w-56 rounded" />
            <div className="skeleton-shimmer mt-3 h-4 w-full rounded" />
            <div className="skeleton-shimmer mt-2 h-4 w-5/6 rounded" />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="skeleton-shimmer h-40 rounded-xl" />
              <div className="skeleton-shimmer h-40 rounded-xl" />
            </div>
          </section>
        }
      >
        <QuickFixesPageClient />
      </Suspense>

      <p className="mt-6 text-sm text-slate-300">
        Need a full walkthrough?{" "}
        <Link href="/security-headers-guide" className="text-sky-300 transition hover:text-sky-200">
          Open the security headers guide
        </Link>
        .
      </p>

      <SiteFooter className="mt-10" />
    </main>
  );
}
