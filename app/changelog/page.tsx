import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Changelog",
  description:
    "See the latest Security Header Checker releases, including scan mode enhancements, reporting improvements, and performance updates.",
  path: "/changelog"
});

const RELEASES = [
  {
    version: "v1.6.0",
    date: "Mar 2026",
    notes: [
      "Added a CI/CD integration guide at /docs/ci-cd with copy-ready GitHub Actions, GitLab CI, and generic shell examples.",
      "Shipped webhook integrations with authenticated CRUD management and automatic grade-change delivery from scheduled watchlist scans.",
      "Introduced an Integrations section in Settings for webhook administration, API key generation, and one-click copy actions.",
      "Extended /api/check to support authenticated access through user-generated API keys."
    ]
  },
  {
    version: "v1.5.0",
    date: "Mar 2026",
    notes: [
      "Expanded bulk mode with sortable columns, result filters, and in-table detail modals for faster triage.",
      "Added markdown-table copy workflows for bulk results alongside CSV export improvements.",
      "Introduced recent comparison history with local persistence, one-click re-run, and account sync.",
      "Added opt-in browser notifications for scan completion with per-account settings support."
    ]
  },
  {
    version: "v1.4.0",
    date: "Mar 2026",
    notes: [
      "Added watchlist monitoring improvements with smarter auto-refresh scheduling.",
      "Expanded PDF export layout for cleaner single-scan and compare reports.",
      "Improved scan history caching for faster repeated views."
    ]
  },
  {
    version: "v1.3.0",
    date: "Feb 2026",
    notes: [
      "Released shareable scan report URLs with encoded payload support.",
      "Added embeddable badge API styles for dashboards and README usage.",
      "Introduced keyboard shortcuts and accessibility announcements."
    ]
  },
  {
    version: "v1.2.0",
    date: "Jan 2026",
    notes: [
      "Launched bulk scan mode for checking multiple domains in one run.",
      "Added side-by-side comparison mode with header-level differences.",
      "Shipped fix suggestions panel with configuration guidance per header."
    ]
  },
  {
    version: "v1.0.0",
    date: "Dec 2025",
    notes: [
      "Initial public release of Security Header Checker.",
      "Included single URL scan mode with grade scoring and detailed findings.",
      "Added dark/light theme support and persistent local preferences."
    ]
  }
] as const;

export default function ChangelogPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />

      <section className="mb-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <h1 className="text-3xl font-semibold text-slate-100 sm:text-4xl">Product changelog</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Follow release progress across scanner accuracy, developer APIs, report sharing, and deployment-readiness
          quality-of-life updates.
        </p>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        {RELEASES.map((release) => (
          <article key={release.version} className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold text-slate-100">{release.version}</h2>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{release.date}</p>
            </div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
              {release.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <p className="mt-6 text-sm text-slate-300">
        Looking for available endpoints and examples?{" "}
        <Link href="/docs" className="text-sky-300 transition hover:text-sky-200">
          View API docs
        </Link>
        .
      </p>

      <SiteFooter className="mt-10" />
    </main>
  );
}
