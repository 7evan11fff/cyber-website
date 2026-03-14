import Link from "next/link";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />

      <section className="mt-10 rounded-2xl border border-sky-500/25 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-8 shadow-2xl shadow-slate-950/70">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">404 · Page not found</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-100 sm:text-4xl">This page was moved or no longer exists.</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
          The link might be outdated, or the URL may have been typed incorrectly. Use one of the quick routes below to
          continue scanning and hardening your sites.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg border border-sky-500/50 bg-sky-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-sky-100 transition hover:border-sky-400 hover:bg-sky-500/15"
          >
            Go to home
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
          >
            Open scanner
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
          >
            Dashboard
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/blog"
          className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 text-sm text-slate-300 transition hover:border-sky-500/50 hover:text-slate-100"
        >
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Read</p>
          <p className="mt-1 text-base font-semibold text-slate-100">Blog & announcements</p>
          <p className="mt-1">Get practical guidance on CSP, HSTS, and browser hardening.</p>
        </Link>
        <Link
          href="/docs"
          className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 text-sm text-slate-300 transition hover:border-sky-500/50 hover:text-slate-100"
        >
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Build</p>
          <p className="mt-1 text-base font-semibold text-slate-100">Docs & API</p>
          <p className="mt-1">Integrate checks into CI/CD and automated quality gates.</p>
        </Link>
        <Link
          href="/contact"
          className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 text-sm text-slate-300 transition hover:border-sky-500/50 hover:text-slate-100"
        >
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Need help</p>
          <p className="mt-1 text-base font-semibold text-slate-100">Contact support</p>
          <p className="mt-1">Reach out for troubleshooting, integrations, or launch support.</p>
        </Link>
      </section>

      <SiteFooter className="mt-10" />
    </main>
  );
}
