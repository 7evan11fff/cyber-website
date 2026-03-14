import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "API Docs",
  description:
    "Security Header Checker API documentation for the badge and check endpoints with copy-ready examples.",
  path: "/docs"
});

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <code>{code}</code>
    </pre>
  );
}

export default function DocsPage() {
  const docsStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Security Header Checker API Docs",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    url: absoluteUrl("/docs"),
    description:
      "Reference documentation for the Security Header Checker API, including badge and check endpoint examples."
  };

  const badgeCurlExample = `curl "https://security-header-checker.vercel.app/api/badge/github.com?style=flat"`;
  const badgeMarkdownExample =
    "![Security headers grade for github.com](https://security-header-checker.vercel.app/api/badge/github.com?style=flat)";
  const badgeHtmlExample =
    '<img src="https://security-header-checker.vercel.app/api/badge/github.com?style=flat-square" alt="Security headers grade badge for github.com" />';

  const checkCurlExample = `curl -X POST "https://security-header-checker.vercel.app/api/check" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://example.com"}'`;

  const checkFetchExample = `const response = await fetch("/api/check", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: "https://example.com" })
});

const report = await response.json();
console.log(report.grade, report.score, report.results);`;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(docsStructuredData) }}
      />
      <SiteNav />

      <section className="mb-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <h1 className="text-3xl font-semibold text-slate-100 sm:text-4xl">API Documentation</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Use the Security Header Checker API to embed live security badges and run automated header checks in CI,
          scripts, monitoring jobs, and dashboards.
        </p>
        <p className="mt-3 text-sm text-slate-300">
          Need pipeline-ready examples?{" "}
          <Link href="/docs/ci-cd" className="text-sky-300 transition hover:text-sky-200">
            Open the CI/CD integration guide
          </Link>
          .
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Endpoint 1</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-100">Badge API: /api/badge/[domain]</h2>
          <p className="mt-3 text-sm text-slate-300">
            Returns an SVG badge for the target domain&apos;s latest security header grade. Great for README files,
            project dashboards, and website status pages.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>
              <span className="font-medium text-slate-100">Method:</span> GET
            </li>
            <li>
              <span className="font-medium text-slate-100">Path:</span> /api/badge/[domain]
            </li>
            <li>
              <span className="font-medium text-slate-100">Query:</span> style=flat or style=flat-square
            </li>
            <li>
              <span className="font-medium text-slate-100">Response:</span> image/svg+xml
            </li>
          </ul>

          <h3 className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">curl example</h3>
          <CodeBlock code={badgeCurlExample} />

          <h3 className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
            Embed in Markdown
          </h3>
          <CodeBlock code={badgeMarkdownExample} />

          <h3 className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Embed in HTML</h3>
          <CodeBlock code={badgeHtmlExample} />
        </article>

        <article className="mt-5 rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Endpoint 2</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-100">Check API: /api/check</h2>
          <p className="mt-3 text-sm text-slate-300">
            Programmatically scan one URL and receive a structured report with grade, score, HTTP status, and header
            recommendations.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>
              <span className="font-medium text-slate-100">Method:</span> POST
            </li>
            <li>
              <span className="font-medium text-slate-100">Path:</span> /api/check
            </li>
            <li>
              <span className="font-medium text-slate-100">Body:</span> {"{ \"url\": \"https://example.com\" }"}
            </li>
            <li>
              <span className="font-medium text-slate-100">Auth (optional):</span> Authorization: Bearer &lt;API key&gt;
            </li>
            <li>
              <span className="font-medium text-slate-100">Response:</span> JSON security report
            </li>
          </ul>

          <h3 className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">curl example</h3>
          <CodeBlock code={checkCurlExample} />

          <h3 className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
            JavaScript fetch example
          </h3>
          <CodeBlock code={checkFetchExample} />
        </article>
      </section>

      <p className="mt-6 text-sm text-slate-300">
        Need context on the headers first?{" "}
        <Link href="/about" className="text-sky-300 transition hover:text-sky-200">
          Visit the About page
        </Link>
        .
      </p>

      <SiteFooter className="mt-10" />
    </main>
  );
}
