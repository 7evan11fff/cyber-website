import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy Policy",
  description:
    "Learn what data Security Header Checker collects, how cookies are used, and what rights you have over your information.",
  path: "/privacy"
});

const PRIVACY_SECTIONS = [
  {
    id: "data-collection",
    title: "Data Collection",
    body: [
      "We collect account details you provide during sign-in (name, email, and profile image from your identity provider) so you can save watchlists, API keys, and settings across sessions.",
      "When you run scans, we store scan metadata like target domain, score, and timestamp to power history, comparisons, and reporting. We do not intentionally collect private content from your web pages."
    ]
  },
  {
    id: "cookie-usage",
    title: "Cookie Usage",
    body: [
      "We use essential cookies and session storage to keep you signed in, protect against abuse, and remember app preferences such as theme and navigation state.",
      "We may also use limited analytics cookies to understand feature usage and improve reliability. You can block non-essential cookies in your browser settings."
    ]
  },
  {
    id: "third-parties",
    title: "Third Parties",
    body: [
      "Security Header Checker relies on infrastructure and identity providers (for example, hosting, authentication, and email delivery) to operate the service. Those vendors only receive data needed to perform their contracted function.",
      "We do not sell personal data. When third-party processors are used, we require safeguards aligned with standard SaaS security expectations."
    ]
  },
  {
    id: "user-rights",
    title: "User Rights",
    body: [
      "You can request access, correction, export, or deletion of account-linked data we store for your workspace. You may also revoke API keys and remove saved watchlists from within your account settings at any time.",
      "If you are in a jurisdiction with additional privacy rights, contact us and we will process requests according to applicable law."
    ]
  },
  {
    id: "contact",
    title: "Contact",
    body: [
      "Questions about this policy, privacy requests, or security disclosures can be submitted through our contact page.",
      "We aim to respond to privacy and security inquiries within 5 business days."
    ]
  }
] as const;

export default function PrivacyPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Privacy Policy",
    description:
      "Privacy practices for Security Header Checker including data collection, cookies, third parties, user rights, and contact details.",
    url: absoluteUrl("/privacy"),
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
        <h1 className="mt-2 text-3xl font-semibold text-slate-100 sm:text-4xl">Privacy Policy</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          This policy explains how Security Header Checker collects, uses, and protects information while you use our
          security header scanning platform.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70">
        <div className="space-y-6">
          {PRIVACY_SECTIONS.map((section) => (
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
        Looking for service terms?{" "}
        <Link href="/terms" className="text-sky-300 transition hover:text-sky-200">
          Review Terms of Service
        </Link>
        .
      </p>

      <SiteFooter className="mt-10" />
    </main>
  );
}
