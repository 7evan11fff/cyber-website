import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/app/components/ContactForm";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact",
  description:
    "Contact the Security Header Checker team for support, feature requests, compliance questions, or launch partnerships.",
  path: "/contact"
});

export default function ContactPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Contact",
    description: "Contact page for Security Header Checker support and partnership inquiries.",
    url: absoluteUrl("/contact"),
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Contact</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100 sm:text-4xl">Talk to the Security Header Checker team</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Need launch support, integration help, or guidance on a scan result? Send us a message and include as much
          context as possible.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70">
          <h2 className="text-xl font-semibold text-slate-100">Send a message</h2>
          <p className="mt-2 text-sm text-slate-300">
            We use this inbox for product feedback, security and privacy requests, and onboarding questions.
          </p>
          <div className="mt-5">
            <ContactForm />
          </div>
        </article>

        <aside className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70">
          <h2 className="text-lg font-semibold text-slate-100">What to include</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
            <li>Your target domain or report URL (if applicable)</li>
            <li>What you expected to happen</li>
            <li>What happened instead, including any error text</li>
            <li>Your timeline if this is launch-critical</li>
          </ul>

          <div className="mt-5 rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
            <p className="text-sm font-medium text-slate-100">Legal and policy links</p>
            <div className="mt-2 flex flex-col gap-1 text-sm">
              <Link href="/privacy" className="text-sky-300 transition hover:text-sky-200">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sky-300 transition hover:text-sky-200">
                Terms of Service
              </Link>
            </div>
          </div>
        </aside>
      </section>

      <SiteFooter className="mt-10" />
    </main>
  );
}
