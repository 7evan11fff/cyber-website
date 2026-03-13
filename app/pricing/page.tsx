import type { Metadata } from "next";
import Link from "next/link";
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
    subtitle: "Perfect for solo developers and quick audits.",
    price: "$0",
    cadence: "/month",
    cta: "Start scanning",
    highlight: false,
    features: [
      "100 API checks per month",
      "Watchlist up to 10 sites",
      "Single and compare scan modes",
      "Basic shareable report links",
      "Community support"
    ]
  },
  {
    name: "Pro",
    subtitle: "For growing teams running security checks weekly.",
    price: "$29",
    cadence: "/month",
    cta: "Upgrade to Pro",
    highlight: true,
    features: [
      "5,000 API checks per month",
      "Watchlist up to 200 sites",
      "Bulk scans and scan-history caching",
      "Unlimited PDF report exports",
      "Email alert notifications and priority support"
    ]
  },
  {
    name: "Enterprise",
    subtitle: "For multi-product organizations with strict compliance needs.",
    price: "Custom",
    cadence: "",
    cta: "Talk to sales",
    highlight: false,
    features: [
      "Unlimited API checks with SLA",
      "Watchlist up to 5,000 sites",
      "SAML SSO and RBAC controls",
      "Dedicated badge API infrastructure",
      "Custom onboarding and security review support"
    ]
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
        price: tier.price === "Custom" ? undefined : tier.price.replace("$", ""),
        priceCurrency: tier.price === "Custom" ? undefined : "USD",
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
        <h1 className="text-3xl font-semibold text-slate-100 sm:text-4xl">Simple pricing for every team size</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Choose the plan that matches your monitoring cadence. Start free, then scale into higher API throughput,
          larger watchlists, and richer reporting workflows as your security program matures.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
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
            <p className="mt-3 text-sm text-slate-300">{tier.subtitle}</p>

            <ul className="mt-4 space-y-2 text-sm text-slate-200">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <span className="mt-0.5 text-sky-300">•</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              className={`mt-6 w-full rounded-lg px-3 py-2 text-sm font-semibold uppercase tracking-[0.12em] transition ${
                tier.highlight
                  ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
                  : "border border-slate-700 bg-slate-950/80 text-slate-200 hover:border-sky-500/60 hover:text-sky-200"
              }`}
            >
              {tier.cta}
            </button>
          </article>
        ))}
      </section>

      <p className="mt-6 text-sm text-slate-300">
        Want to evaluate before choosing a plan?{" "}
        <Link href="/" className="text-sky-300 transition hover:text-sky-200">
          Run a free security header scan
        </Link>
        .
      </p>

      <SiteFooter className="mt-10" />
    </main>
  );
}
