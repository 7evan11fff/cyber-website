import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Terms of Service",
  description:
    "Read the Security Header Checker terms covering acceptable use, limitations, disclaimers, and account termination.",
  path: "/terms"
});

const TERMS_SECTIONS = [
  {
    id: "acceptance",
    title: "Acceptance",
    body: [
      "By accessing or using Security Header Checker, you agree to these Terms of Service. If you do not agree, do not use the service.",
      "You are responsible for ensuring your use complies with applicable laws and contractual obligations."
    ]
  },
  {
    id: "service-description",
    title: "Service Description",
    body: [
      "Security Header Checker provides website security header analysis, score reporting, watchlist tracking, and related workflow tools for development and security teams.",
      "Feature availability, scan limits, and integrations may change as we improve the service."
    ]
  },
  {
    id: "user-obligations",
    title: "User Obligations",
    body: [
      "You agree to use the service only for systems you are authorized to test. You must not abuse rate limits, attempt unauthorized access, or interfere with platform stability.",
      "You are solely responsible for your remediation decisions and for securing any credentials, webhooks, and API keys associated with your account."
    ]
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    body: [
      "The service is provided on an \"as is\" and \"as available\" basis. We do not warrant uninterrupted operation or that every vulnerability, misconfiguration, or risk will be identified.",
      "Security guidance and grades are informational and should be combined with broader testing and internal review."
    ]
  },
  {
    id: "liability",
    title: "Liability",
    body: [
      "To the maximum extent permitted by law, Security Header Checker and its maintainers are not liable for indirect, incidental, or consequential damages resulting from service use.",
      "Our total liability for claims arising from these terms is limited to the amount you paid us for the service in the prior 12 months."
    ]
  },
  {
    id: "termination",
    title: "Termination",
    body: [
      "We may suspend or terminate access for misuse, abuse, or violations of these terms. You may stop using the service at any time.",
      "Upon termination, provisions that by nature should survive (including disclaimers and liability limits) will remain in effect."
    ]
  }
] as const;

export default function TermsPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Terms of Service",
    description:
      "Terms of Service for Security Header Checker including acceptance, user obligations, disclaimers, liability, and termination.",
    url: absoluteUrl("/terms"),
    inLanguage: "en-US",
    isPartOf: {
      "@type": "WebSite",
      name: "Security Header Checker",
      url: absoluteUrl("/")
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <SiteNav />

      <section className="mb-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Legal</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100 sm:text-4xl">Terms of Service</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          These terms govern your use of Security Header Checker and outline acceptable use, service limitations, and
          legal responsibilities.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70">
        <div className="space-y-6">
          {TERMS_SECTIONS.map((section) => (
            <article key={section.id} id={section.id} className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
              <h2 className="text-xl font-semibold text-slate-100">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm text-slate-300">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <p className="mt-6 text-sm text-slate-300">
        Questions about these terms?{" "}
        <Link href="/contact" className="text-sky-300 transition hover:text-sky-200">
          Contact the team
        </Link>
        .
      </p>

      <SiteFooter className="mt-10" />
    </main>
  );
}
