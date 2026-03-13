import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { HEADER_GUIDANCE } from "@/lib/headerGuidance";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn what HTTP security headers do, common configuration mistakes, and where to find authoritative guidance."
};

const RESOURCES = [
  { label: "securityheaders.com", href: "https://securityheaders.com/" },
  { label: "Mozilla Observatory", href: "https://observatory.mozilla.org/" },
  { label: "OWASP Secure Headers Project", href: "https://owasp.org/www-project-secure-headers/" },
  {
    label: "MDN: HTTP security headers",
    href: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP"
  }
];

export default function AboutPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />

      <section className="mb-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <h1 className="text-3xl font-semibold text-slate-100 sm:text-4xl">About Security Headers</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Security headers are HTTP response rules that tell browsers how to load and isolate your application.
          They reduce risk from common issues like XSS, clickjacking, mixed-content leaks, and cross-origin data
          exposure.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <h2 className="text-2xl font-semibold text-slate-100">What each header does</h2>
        <p className="mt-2 text-sm text-slate-300">
          Below are the headers checked by this tool, why each matters, and common pitfalls to avoid.
        </p>

        <div className="mt-5 space-y-4">
          {HEADER_GUIDANCE.map((item) => (
            <article key={item.key} className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
              <h3 className="text-lg font-semibold text-slate-100">{item.label}</h3>
              <p className="mt-2 text-sm text-slate-300">{item.purpose}</p>
              <p className="mt-2 text-xs text-slate-400">
                Recommended baseline:
                <code className="ml-2 rounded bg-slate-950 px-1.5 py-0.5 text-slate-200">{item.recommendedValue}</code>
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
                {item.commonMisconfigurations.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <h2 className="text-2xl font-semibold text-slate-100">Further reading and tools</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {RESOURCES.map((resource) => (
            <li key={resource.href}>
              <a
                href={resource.href}
                target="_blank"
                rel="noreferrer"
                className="text-sky-300 transition hover:text-sky-200"
              >
                {resource.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-300">
          Ready to test your site?{" "}
          <Link href="/" className="text-sky-300 transition hover:text-sky-200">
            Run a scan in the Security Header Checker
          </Link>
          .
        </p>
      </section>

      <SiteFooter className="mt-10" />
    </main>
  );
}
