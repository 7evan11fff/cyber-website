import type { Metadata } from "next";
import Link from "next/link";
import { ProWaitlistSignup } from "@/app/components/ProWaitlistSignup";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Pricing",
  description:
    "Compare Security Header Checker plans for API limits, watchlist capacity, PDF exports, and deployment monitoring.",
  path: "/pricing"
});

const TIERS = [
  {
    name: "Free",
    badge: "Current plan",
    subtitle: "Everything you need to run scans and start monitoring.",
    price: "$0",
    cadence: "/month",
    cta: "Start scanning",
    ctaHref: "/",
    highlight: false,
    features: [
      "Single, compare, and bulk scan modes",
      "Up to 100 API checks / month",
      "Watchlist with grade-change alerts",
      "Share links, PDF export, and badge generation"
    ]
  },
  {
    name: "Pro",
    badge: "Coming soon",
    subtitle: "A placeholder for teams that need more throughput and collaboration.",
    price: "TBD",
    cadence: "",
    cta: "Join waitlist",
    ctaHref: "/settings",
    highlight: true,
    features: [
      "Higher API rate and monthly limits",
      "Priority support for incident workflows",
      "Team workspaces and shared watchlists",
      "Advanced governance and audit tooling"
    ]
  }
] as const;

const COMPARISON_ROWS = [
  { capability: "Single URL scan", free: "Included", pro: "Included" },
  { capability: "Compare mode", free: "Included", pro: "Included" },
  { capability: "Bulk scan", free: "Up to 10 URLs / run", pro: "Higher per-run cap" },
  { capability: "API checks", free: "100 / month", pro: "Higher monthly quota" },
  { capability: "Watchlist alerts", free: "Included", pro: "Priority delivery + routing" },
  { capability: "Support", free: "Community", pro: "Priority support" },
  { capability: "Team features", free: "Not included", pro: "Planned" }
] as const;

const PRICING_FAQ = [
  {
    question: "Do I need to pay to use the scanner right now?",
    answer:
      "No. The current experience remains free and includes scanning, compare mode, watchlist tracking, and API key access with base limits."
  },
  {
    question: "When will Pro be available?",
    answer:
      "Pro is a launch placeholder while we validate the feature set. You can monitor updates on the changelog and opt in from settings."
  },
  {
    question: "Will current free features disappear?",
    answer:
      "No. Free-tier capabilities shown on this page are intended to remain available, while Pro expands limits and collaboration workflows."
  }
] as const;

export default function PricingPage() {
  const pricingStructuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Security Header Checker",
    applicationCategory: "SecurityApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "OfferCatalog",
      name: "Security Header Checker Pricing",
      itemListElement: TIERS.map((tier, index) => ({
        "@type": "Offer",
        position: index + 1,
        name: tier.name,
        price: tier.price === "TBD" ? undefined : tier.price.replace("$", ""),
        priceCurrency: tier.price === "TBD" ? undefined : "USD",
        description: tier.subtitle
      })).filter((offer) => offer.price !== undefined)
    },
    url: absoluteUrl("/pricing"),
    description:
      "Choose a Security Header Checker plan with the scan capacity and watchlist features your team needs."
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingStructuredData) }}
      />
      <SiteNav />

      <section className="mb-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Pricing</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100 sm:text-4xl">Simple tiers for launch and beyond</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Start on the free plan available today, then upgrade to Pro when your team needs higher limits, priority
          support, and collaboration features.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {TIERS.map((tier) => (
          <article
            key={tier.name}
            className={`rounded-2xl border p-6 shadow-2xl backdrop-blur ${
              tier.highlight
                ? "border-sky-500/50 bg-sky-500/10 shadow-sky-950/50"
                : "border-slate-800/80 bg-slate-900/70 shadow-slate-950/70"
            }`}
          >
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{tier.name}</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100">{tier.price}</h2>
            <p className="text-sm text-slate-400">{tier.cadence}</p>
            <p className="mt-2 inline-flex rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-slate-300">
              {tier.badge}
            </p>
            <p className="mt-3 text-sm text-slate-300">{tier.subtitle}</p>

            <ul className="mt-4 space-y-2 text-sm text-slate-200">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <span className="mt-0.5 text-sky-300">•</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              href={tier.ctaHref}
              className={`mt-6 block w-full rounded-lg px-3 py-2 text-center text-sm font-semibold uppercase tracking-[0.12em] transition ${
                tier.highlight
                  ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
                  : "border border-slate-700 bg-slate-950/80 text-slate-200 hover:border-sky-500/60 hover:text-sky-200"
              }`}
            >
              {tier.cta}
            </Link>
          </article>
        ))}
      </section>

      <ProWaitlistSignup />

      <section className="mt-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70">
        <h2 className="text-xl font-semibold text-slate-100">Plan comparison</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800/90">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900/70 text-xs uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Capability</th>
                <th className="px-4 py-3">Free</th>
                <th className="px-4 py-3">Pro</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.capability} className="border-t border-slate-800/70">
                  <td className="px-4 py-3 text-slate-200">{row.capability}</td>
                  <td className="px-4 py-3 text-slate-300">{row.free}</td>
                  <td className="px-4 py-3 text-slate-300">{row.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70">
        <h2 className="text-xl font-semibold text-slate-100">Pricing FAQ</h2>
        <div className="mt-4 space-y-3">
          {PRICING_FAQ.map((item) => (
            <details
              key={item.question}
              className="motion-card rounded-xl border border-slate-800/90 bg-slate-950/60 p-4 text-sm text-slate-300"
            >
              <summary className="cursor-pointer list-none font-medium text-slate-100">{item.question}</summary>
              <p className="mt-3">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="mt-6 text-sm text-slate-300">
        Have feedback on tier design?{" "}
        <Link href="/settings" className="text-sky-300 transition hover:text-sky-200">
          Share preferences from settings
        </Link>
        .
      </p>

      <SiteFooter className="mt-10" />
    </main>
  );
}
