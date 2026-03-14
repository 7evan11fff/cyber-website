import Link from "next/link";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";

export default function OfflinePage() {
  return (
    <main id="main-content" className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />
      <section className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-6 shadow-xl shadow-slate-950/60">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Offline mode</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100 sm:text-3xl">You are currently offline</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300">
          Some previously loaded pages and scan history remain available, but live scans require an internet connection.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/"
            className="pressable min-h-11 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            Return to scanner
          </Link>
          <Link
            href="/dashboard"
            className="pressable min-h-11 rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
          >
            Open dashboard
          </Link>
        </div>
      </section>
      <SiteFooter className="mt-10" />
    </main>
  );
}
