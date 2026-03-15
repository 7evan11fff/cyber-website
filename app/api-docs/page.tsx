import type { Metadata } from "next";
import Link from "next/link";
import { ApiDocsPlayground } from "@/app/components/ApiDocsPlayground";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "API Docs",
  description:
    "Integrate Security Header Checker with the /api/check endpoint, API keys, request examples, and rate limits.",
  path: "/api-docs"
});

const CURL_EXAMPLE = `curl -X POST "https://security-header-checker.vercel.app/api/check" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer shc_xxxxxxxxx" \\
  -d '{"url":"https://example.com"}'`;

const JS_EXAMPLE = `const response = await fetch("https://security-header-checker.vercel.app/api/check", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer shc_xxxxxxxxx"
  },
  body: JSON.stringify({ url: "https://example.com" })
});

const result = await response.json();
console.log(result.grade, result.score);`;

const PYTHON_EXAMPLE = `import requests

response = requests.post(
    "https://security-header-checker.vercel.app/api/check",
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer shc_xxxxxxxxx",
    },
    json={"url": "https://example.com"},
    timeout=15,
)

result = response.json()
print(result["grade"], result["score"])`;

const RESPONSE_EXAMPLE = `{
  "checkedUrl": "https://example.com",
  "finalUrl": "https://example.com/",
  "statusCode": 200,
  "score": 16,
  "maxScore": 17,
  "grade": "A",
  "results": [
    {
      "key": "strict-transport-security",
      "label": "Strict-Transport-Security",
      "status": "good",
      "present": true,
      "value": "max-age=31536000; includeSubDomains; preload",
      "guidance": "Use at least one year with includeSubDomains."
    }
  ],
  "securityTxtAnalysis": {
    "available": true,
    "checkedUrl": "https://example.com/",
    "fetchedUrl": "https://example.com/.well-known/security.txt",
    "fetchedFrom": "/.well-known/security.txt",
    "fallbackUsed": false,
    "statusCode": 200,
    "fields": {
      "contact": ["mailto:security@example.com"],
      "expires": "2027-01-31T00:00:00Z",
      "encryption": [],
      "acknowledgments": [],
      "preferredLanguages": ["en"],
      "canonical": ["https://example.com/.well-known/security.txt"],
      "policy": ["https://example.com/security-policy"],
      "hiring": []
    },
    "validation": {
      "present": true,
      "usesHttps": true,
      "hasContact": true,
      "hasExpires": true,
      "expiresValidFormat": true,
      "expiresExpired": false,
      "expiresExpiringSoon": false,
      "isValid": true
    },
    "warnings": [],
    "recommendations": [],
    "score": 1,
    "maxScore": 1,
    "grade": "A",
    "summary": "security.txt is present, served over HTTPS, and includes valid Contact and Expires metadata."
  },
  "checkedAt": "2026-03-14T16:20:47.328Z"
}`;

const CLI_EXAMPLE = `# Zero-install run
px @security-header-checker/cli https://example.com --fail-under B

# JSON mode for pipelines
px @security-header-checker/cli https://example.com --json --api-key "$SECURITY_HEADERS_API_KEY"`;

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <code>{code}</code>
    </pre>
  );
}

export default function ApiDocsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />

      <section className="mb-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">API Docs</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100 sm:text-4xl">Integrate /api/check in minutes</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Use Security Header Checker in CI pipelines, release checks, and internal tooling. This page documents
          authentication, payloads, responses, and practical examples for the scanner endpoint.
        </p>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-2">
        <article className="motion-card rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70">
          <h2 className="text-xl font-semibold text-slate-100">Endpoint</h2>
          <p className="mt-3 text-sm text-slate-300">
            <span className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">
              POST
            </span>{" "}
            <code className="rounded bg-slate-950 px-2 py-1 text-slate-100">/api/check</code>
          </p>
          <p className="mt-3 text-sm text-slate-300">
            Send JSON with a target URL:
            <code className="ml-1 rounded bg-slate-950 px-2 py-1 text-slate-100">{`{ "url": "https://example.com" }`}</code>
          </p>
          <p className="mt-3 text-sm text-slate-300">
            The response includes grade, score, status code, normalized final URL, per-header guidance, and optional
            deeper modules like CORS/TLS/DNS/SRI/security.txt analysis.
          </p>
        </article>

        <article className="motion-card rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70">
          <h2 className="text-xl font-semibold text-slate-100">Authentication + API key</h2>
          <p className="mt-3 text-sm text-slate-300">
            For higher limits and account attribution, include your API key using either:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
            <li>
              <code className="rounded bg-slate-950 px-1.5 py-0.5 text-slate-100">Authorization: Bearer shc_...</code>
            </li>
            <li>
              <code className="rounded bg-slate-950 px-1.5 py-0.5 text-slate-100">x-api-key: shc_...</code>
            </li>
          </ul>
          <p className="mt-3 text-sm text-slate-300">
            Generate or rotate your key in{" "}
            <Link href="/settings" className="text-sky-300 transition hover:text-sky-200">
              Settings
            </Link>
            .
          </p>
        </article>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70">
        <h2 className="text-xl font-semibold text-slate-100">Rate limits</h2>
        <p className="mt-3 text-sm text-slate-300">
          API responses include <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code>, and{" "}
          <code>X-RateLimit-Reset</code>. Throttled requests return <code>429</code> with <code>Retry-After</code>.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800/90">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900/70 text-xs uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Burst window</th>
                <th className="px-4 py-3">Monthly checks</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-800/70">
                <td className="px-4 py-3 text-slate-200">Free / unauthenticated</td>
                <td className="px-4 py-3 text-slate-300">~30 requests/minute</td>
                <td className="px-4 py-3 text-slate-300">Up to 100</td>
              </tr>
              <tr className="border-t border-slate-800/70">
                <td className="px-4 py-3 text-slate-200">API key (current app users)</td>
                <td className="px-4 py-3 text-slate-300">~100 requests/minute</td>
                <td className="px-4 py-3 text-slate-300">Higher active-user quota</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70">
        <article>
          <h2 className="text-xl font-semibold text-slate-100">Official CLI</h2>
          <p className="mt-2 text-sm text-slate-300">
            Install-free usage is available through <code>px @security-header-checker/cli</code>. The CLI wraps{" "}
            <code>/api/check</code> and supports <code>--json</code>, <code>--fail-under</code>, <code>--api-key</code>
            , and <code>--timeout</code>.
          </p>
          <CodeBlock code={CLI_EXAMPLE} />
        </article>
        <article>
          <h2 className="text-xl font-semibold text-slate-100">curl example</h2>
          <CodeBlock code={CURL_EXAMPLE} />
        </article>
        <article>
          <h2 className="text-xl font-semibold text-slate-100">JavaScript example</h2>
          <CodeBlock code={JS_EXAMPLE} />
        </article>
        <article>
          <h2 className="text-xl font-semibold text-slate-100">Python example</h2>
          <CodeBlock code={PYTHON_EXAMPLE} />
        </article>
        <article>
          <h2 className="text-xl font-semibold text-slate-100">Sample response</h2>
          <CodeBlock code={RESPONSE_EXAMPLE} />
        </article>
      </section>

      <ApiDocsPlayground />

      <p className="mt-6 text-sm text-slate-300">
        Need broader endpoint coverage?{" "}
        <Link href="/docs/api" className="text-sky-300 transition hover:text-sky-200">
          Open full API reference
        </Link>
        .
      </p>

      <SiteFooter className="mt-10" />
    </main>
  );
}
