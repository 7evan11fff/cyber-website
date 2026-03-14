import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { INTEGRATION_CARDS } from "@/lib/integrationGuides";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Integrations",
  description:
    "Integration guides for Security Header Checker across CI/CD pipelines and team notification platforms.",
  path: "/integrations"
});

export default function IntegrationsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />

      <section className="mb-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Automation hub</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-100 sm:text-4xl">Integrations</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Automate security-header monitoring in your delivery pipeline and incident workflows. Run scans during CI,
          enforce minimum grades before merge, and send watchlist change notifications to the tools your team already
          uses.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <h2 className="text-xl font-semibold text-slate-100">Available integration guides</h2>
        <p className="mt-2 text-sm text-slate-300">
          Each guide includes copy-paste examples you can adapt to your own environment.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {INTEGRATION_CARDS.map((card) => (
            <article
              key={card.slug}
              className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5 shadow-lg shadow-slate-950/40"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-xl"
                >
                  {card.icon}
                </span>
                <h3 className="text-lg font-semibold text-slate-100">{card.name}</h3>
              </div>
              <p className="mt-3 text-sm text-slate-300">{card.description}</p>
              <Link
                href={`/integrations/${card.slug}`}
                className="mt-4 inline-flex rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
              >
                View Guide
              </Link>
            </article>
          ))}
        </div>
      </section>

      <SiteFooter className="mt-10" />
    </main>
  );
}
