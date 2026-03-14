import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { QuickFixesPageClient } from "@/app/components/QuickFixesPageClient";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { buildPageMetadata } from "@/lib/seo";

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
          <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 text-sm text-slate-300">
            Loading quick fixes...
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
