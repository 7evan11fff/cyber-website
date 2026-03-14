import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Developer Docs",
  description:
    "Developer documentation hub for API reference, CI/CD guides, and implementation examples.",
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
    "@type": "TechArticle",
    headline: "Security Header Checker developer documentation",
    url: absoluteUrl("/docs"),
    about: "Security Header Checker API and automation docs"
  };

  const quickStartExample = `const response = await fetch("https://security-header-checker.vercel.app/api/check", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer shc_xxxxxxxxx"
  },
  body: JSON.stringify({ url: "https://example.com" })
});

const report = await response.json();
console.log(report.grade, report.score);`;

  const cliExample = `px @security-header-checker/cli https://example.com --fail-under B
px @security-header-checker/cli https://example.com --json --api-key "$SECURITY_HEADERS_API_KEY"`;

  const actionExample = `- name: Security header scan
  uses: ./.github/actions/security-headers
  with:
    url: https://example.com
    fail-under: B
    api-key: \${{ secrets.SECURITY_HEADERS_API_KEY }}`;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(docsStructuredData) }}
      />
      <SiteNav />

      <section className="mb-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <h1 className="text-3xl font-semibold text-slate-100 sm:text-4xl">Developer documentation</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Everything you need to integrate Security Header Checker in production workflows: full API contracts,
          authentication, rate limits, endpoint examples, and pipeline automation guides.
        </p>
      </section>

      <section className="grid gap-5 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur md:grid-cols-2">
        <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Primary</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-100">Full API reference</h2>
          <p className="mt-3 text-sm text-slate-300">
            Complete endpoint-by-endpoint documentation for request and response formats, authentication requirements,
            rate limiting, and error semantics.
          </p>
          <Link
            href="/docs/api"
            className="mt-4 inline-flex rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
          >
            Open API reference
          </Link>
        </article>

        <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Automation</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-100">CI/CD integration guide</h2>
          <p className="mt-3 text-sm text-slate-300">
            Copy-ready scripts and pipeline examples for GitHub Actions, GitLab CI, and generic shell runners.
          </p>
          <Link
            href="/docs/ci-cd"
            className="mt-4 inline-flex rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
          >
            Open CI/CD guide
          </Link>
        </article>

        <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">CLI</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-100">@security-header-checker/cli</h2>
          <p className="mt-3 text-sm text-slate-300">
            Run header checks locally or in CI with a single command. Supports threshold gates, JSON output, API keys,
            and custom timeouts.
          </p>
          <CodeBlock code={cliExample} />
        </article>

        <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">GitHub Action</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-100">CI gate + PR comment</h2>
          <p className="mt-3 text-sm text-slate-300">
            Use the bundled action to scan URLs in pull requests and workflow dispatch runs. It publishes outputs and
            posts a formatted PR comment with scan results.
          </p>
          <CodeBlock code={actionExample} />
        </article>
      </section>

      <section className="mt-5 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <h2 className="text-xl font-semibold text-slate-100">Quick start</h2>
        <p className="mt-2 text-sm text-slate-300">
          Use this example to call the scan API from Node.js, serverless jobs, or CI checks.
        </p>
        <CodeBlock code={quickStartExample} />
      </section>

      <p className="mt-6 text-sm text-slate-300">
        Need context on what each header means?{" "}
        <Link href="/about" className="text-sky-300 transition hover:text-sky-200">
          Visit the About page
        </Link>
        .
      </p>

      <SiteFooter className="mt-10" />
    </main>
  );
}
