import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: "API Reference",
  description:
    "Complete Security Header Checker API reference for authentication, request/response formats, rate limits, and error handling.",
  path: "/docs/api"
});

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <code>{code}</code>
    </pre>
  );
}

function EndpointCard({
  method,
  path,
  auth,
  summary,
  children
}: {
  method: string;
  path: string;
  auth: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">
          {method}
        </span>
        <code className="rounded-md bg-slate-900 px-2 py-1 text-xs text-slate-200">{path}</code>
      </div>
      <p className="mt-3 text-sm text-slate-300">{summary}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">
        Auth: <span className="text-slate-300">{auth}</span>
      </p>
      <div className="mt-4 text-sm text-slate-300">{children}</div>
    </article>
  );
}

const CHECK_REQUEST_EXAMPLE = `curl -X POST "https://security-header-checker.vercel.app/api/check" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer shc_xxxxxxxxx" \\
  -d '{"url":"https://example.com"}'`;

const CHECK_RESPONSE_EXAMPLE = `{
  "checkedUrl": "https://example.com",
  "finalUrl": "https://example.com/",
  "statusCode": 200,
  "score": 41,
  "maxScore": 48,
  "grade": "B",
  "responseTimeMs": 142,
  "scanDurationMs": 142,
  "results": [
    {
      "key": "strict-transport-security",
      "label": "Strict-Transport-Security",
      "status": "good",
      "value": "max-age=31536000; includeSubDomains; preload",
      "guidance": "Use at least one year with includeSubDomains."
    }
  ],
  "corsAnalysis": {
    "allowOrigin": "*",
    "allowMethods": "GET, POST",
    "allowHeaders": "Content-Type",
    "allowCredentials": "false",
    "allowsAnyOrigin": true,
    "allowsCredentials": false,
    "isOverlyPermissive": true,
    "score": 2,
    "maxScore": 4,
    "grade": "D",
    "summary": "CORS findings detected: 1 high risk issue.",
    "findings": [
      {
        "id": "wildcard-origin",
        "header": "access-control-allow-origin",
        "severity": "high",
        "message": "Access-Control-Allow-Origin allows all origins.",
        "recommendation": "Restrict Access-Control-Allow-Origin to explicit trusted origins.",
        "value": "*"
      }
    ]
  },
  "tlsAnalysis": {
    "available": true,
    "checkedHostname": "example.com",
    "checkedPort": 443,
    "tlsVersion": "TLSv1.3",
    "isInsecureTlsVersion": false,
    "prefersTls13": true,
    "cipherName": "TLS_AES_256_GCM_SHA384",
    "cipherVersion": "TLSv1.3",
    "weakAlgorithms": [],
    "issuer": "Let's Encrypt",
    "issuerCategory": "Let's Encrypt",
    "subject": "example.com",
    "validFrom": "Jan  1 00:00:00 2026 GMT",
    "validTo": "Apr  1 23:59:59 2026 GMT",
    "daysUntilExpiration": 18,
    "certificateValid": true,
    "certificateExpired": false,
    "certificateExpiringSoon": true,
    "chainComplete": true,
    "chainLength": 3,
    "selfSigned": false,
    "authorized": true,
    "authorizationError": null,
    "score": 8,
    "maxScore": 10,
    "grade": "B",
    "summary": "TLS findings detected: 1 medium risk issue.",
    "findings": [
      {
        "id": "certificate-expiring-soon",
        "severity": "medium",
        "message": "TLS certificate expires in 18 days.",
        "recommendation": "Renew the certificate before expiry to avoid outages and trust warnings.",
        "evidence": "Apr  1 23:59:59 2026 GMT"
      }
    ]
  },
  "dnsAnalysis": {
    "available": true,
    "checkedHostname": "example.com",
    "dnssecStatus": "configured",
    "hasCaa": true,
    "caaRecords": ["issue letsencrypt.org"],
    "spfRecord": "v=spf1 include:_spf.google.com -all",
    "spfRecords": ["v=spf1 include:_spf.google.com -all"],
    "spfPolicy": "hard-fail",
    "dmarcRecord": "v=DMARC1; p=reject; pct=100",
    "dmarcRecords": ["v=DMARC1; p=reject; pct=100"],
    "dmarcPolicy": "reject",
    "dmarcPct": 100,
    "emailSecurityApplicable": true,
    "mxHosts": ["aspmx.l.google.com"],
    "responseTimes": {
      "lookupMs": 24,
      "dnssecMs": 37,
      "caaMs": 29,
      "spfMs": 32,
      "dmarcMs": 31,
      "mxMs": 26,
      "averageMs": 30
    },
    "score": 10,
    "maxScore": 10,
    "grade": "A",
    "summary": "DNS posture looks healthy with DNSSEC, CAA, SPF, and DMARC controls in a secure state.",
    "findings": []
  },
  "checkedAt": "2026-03-14T16:20:47.328Z"
}`;

const WEBHOOK_CREATE_EXAMPLE = `curl -X POST "https://security-header-checker.vercel.app/api/webhooks" \\
  -H "Content-Type: application/json" \\
  -b "<next-auth-session-cookie>" \\
  -d '{"url":"https://hooks.example.com/security-events"}'`;

const WEBHOOK_TEST_EXAMPLE = `curl -X POST "https://security-header-checker.vercel.app/api/webhooks/test" \\
  -H "Content-Type: application/json" \\
  -b "<next-auth-session-cookie>" \\
  -d '{"url":"https://hooks.slack.com/services/T000/B000/XXXX"}'`;

const WEBHOOK_GENERIC_PAYLOAD_EXAMPLE = `{
  "domain": "example.com",
  "oldGrade": "A",
  "newGrade": "C",
  "timestamp": "2026-03-14T09:30:00.000Z",
  "checkedUrl": "https://example.com/",
  "previousGrade": "A",
  "currentGrade": "C"
}`;

const WEBHOOK_SLACK_PAYLOAD_EXAMPLE = `{
  "text": ":warning: Security Header grade change for example.com: A -> C",
  "blocks": [
    {
      "type": "section",
      "text": { "type": "mrkdwn", "text": ":warning: *Security Header grade change*" }
    }
  ]
}`;

const WEBHOOK_DISCORD_PAYLOAD_EXAMPLE = `{
  "content": "Security Header grade change detected for **example.com**",
  "embeds": [
    {
      "title": "Security Header grade change",
      "fields": [
        { "name": "Domain", "value": "example.com", "inline": true },
        { "name": "Grade", "value": "A -> C", "inline": true }
      ]
    }
  ]
}`;

const CRON_EXAMPLE = `curl -X GET "https://security-header-checker.vercel.app/api/cron/watchlist-scan" \\
  -H "Authorization: Bearer $CRON_SECRET"`;

const BADGE_EXAMPLE =
  `https://security-header-checker.vercel.app/api/badge/github.com?style=flat-square`;

const CLI_INSTALL_EXAMPLE = `# Run instantly (no install)
px @security-header-checker/cli https://example.com

# Optional: install globally
npm install -g @security-header-checker/cli
security-header-checker https://example.com --fail-under B`;

export default function ApiReferencePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Security Header Checker API Reference",
    url: absoluteUrl("/docs/api"),
    about: "Security Header Checker API",
    learningResourceType: "Reference"
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SiteNav />

      <section className="mb-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">API Reference</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100 sm:text-4xl">
          Security Header Checker API
        </h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Production reference for all public and authenticated API endpoints, including request formats, response
          contracts, authentication modes, rate limits, and error behavior.
        </p>
      </section>

      <section className="space-y-5 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
          <h2 className="text-xl font-semibold text-slate-100">Base URL and content types</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>
              <span className="font-medium text-slate-100">Base URL:</span>{" "}
              <code className="rounded bg-slate-900 px-1.5 py-0.5">https://security-header-checker.vercel.app</code>
            </li>
            <li>
              JSON APIs return <code className="rounded bg-slate-900 px-1.5 py-0.5">application/json</code>.
            </li>
            <li>
              <code className="rounded bg-slate-900 px-1.5 py-0.5">/api/badge/[domain]</code> returns{" "}
              <code className="rounded bg-slate-900 px-1.5 py-0.5">image/svg+xml</code>.
            </li>
          </ul>
        </article>

        <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
          <h2 className="text-xl font-semibold text-slate-100">Authentication</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>
              <span className="font-medium text-slate-100">Session auth:</span> Browser sessions (NextAuth cookies) for
              account APIs such as <code>/api/user-data</code>, <code>/api/webhooks</code>, and{" "}
              <code>/api/api-key</code>.
            </li>
            <li>
              <span className="font-medium text-slate-100">API key auth:</span> <code>/api/check</code> supports either{" "}
              <code>Authorization: Bearer shc_...</code> or <code>x-api-key: shc_...</code>.
            </li>
            <li>
              API-key authenticated scans use the authenticated rate-limit tier (higher than anonymous requests).
            </li>
            <li>
              <span className="font-medium text-slate-100">Cron auth:</span>{" "}
              <code>/api/cron/watchlist-scan</code> accepts <code>Authorization: Bearer {"<CRON_SECRET>"}</code> or{" "}
              <code>x-cron-secret</code>.
            </li>
          </ul>
        </article>

        <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
          <h2 className="text-xl font-semibold text-slate-100">CLI installation and usage</h2>
          <p className="mt-2 text-sm text-slate-300">
            Prefer a command-line workflow? The official CLI wraps <code>/api/check</code> and works both with public
            rate limits and API key authentication.
          </p>
          <CodeBlock code={CLI_INSTALL_EXAMPLE} />
        </article>

        <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
          <h2 className="text-xl font-semibold text-slate-100">Rate limits</h2>
          <p className="mt-2 text-sm text-slate-300">
            All API routes are rate-limited. Responses include <code>X-RateLimit-Limit</code>,{" "}
            <code>X-RateLimit-Remaining</code>, and <code>X-RateLimit-Reset</code>. When throttled, APIs return HTTP
            429 with a <code>Retry-After</code> header.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>
              <span className="font-medium text-slate-100">Unauthenticated traffic:</span> ~30 requests/minute per IP.
            </li>
            <li>
              <span className="font-medium text-slate-100">Authenticated traffic:</span> ~100 requests/minute per user
              identity.
            </li>
            <li>
              <span className="font-medium text-slate-100">Cron route:</span> additionally enforces its own invocation
              cap via <code>CRON_ROUTE_RATE_LIMIT_PER_MINUTE</code>.
            </li>
          </ul>
        </article>

        <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
          <h2 className="text-xl font-semibold text-slate-100">Common error codes</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800/90">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900/70 text-xs uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">HTTP</th>
                  <th className="px-4 py-3">Meaning</th>
                  <th className="px-4 py-3">Typical cause</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-800/70">
                  <td className="px-4 py-3 text-slate-200">400</td>
                  <td className="px-4 py-3 text-slate-300">Bad Request</td>
                  <td className="px-4 py-3 text-slate-400">Invalid JSON body, malformed URL, or invalid params.</td>
                </tr>
                <tr className="border-t border-slate-800/70">
                  <td className="px-4 py-3 text-slate-200">401</td>
                  <td className="px-4 py-3 text-slate-300">Unauthorized</td>
                  <td className="px-4 py-3 text-slate-400">Missing/invalid session, API key, or cron secret.</td>
                </tr>
                <tr className="border-t border-slate-800/70">
                  <td className="px-4 py-3 text-slate-200">404</td>
                  <td className="px-4 py-3 text-slate-300">Not Found</td>
                  <td className="px-4 py-3 text-slate-400">Requested webhook item does not exist.</td>
                </tr>
                <tr className="border-t border-slate-800/70">
                  <td className="px-4 py-3 text-slate-200">422</td>
                  <td className="px-4 py-3 text-slate-300">Unprocessable Entity</td>
                  <td className="px-4 py-3 text-slate-400">Semantically invalid payload fields.</td>
                </tr>
                <tr className="border-t border-slate-800/70">
                  <td className="px-4 py-3 text-slate-200">429</td>
                  <td className="px-4 py-3 text-slate-300">Too Many Requests</td>
                  <td className="px-4 py-3 text-slate-400">Rate limit window exceeded.</td>
                </tr>
                <tr className="border-t border-slate-800/70">
                  <td className="px-4 py-3 text-slate-200">5xx</td>
                  <td className="px-4 py-3 text-slate-300">Server Error</td>
                  <td className="px-4 py-3 text-slate-400">Upstream scan/email failure or transient server issue.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="mt-6 space-y-5">
        <EndpointCard
          method="POST"
          path="/api/check"
          auth="Optional (API key raises authenticated limit)"
          summary="Run a live header scan for one URL and receive a scored report."
        >
          <p>Body: {`{ "url": "https://example.com" }`}</p>
          <CodeBlock code={CHECK_REQUEST_EXAMPLE} />
          <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-slate-400">
            <li>
              <code>responseTimeMs</code> reports measured upstream latency in milliseconds.
            </li>
            <li>
              <code>scanDurationMs</code> is kept for backward compatibility and mirrors response timing.
            </li>
            <li>
              <code>corsAnalysis</code> includes CORS findings, score, grade, and parsed allow-* headers.
            </li>
            <li>
              <code>tlsAnalysis</code> includes certificate validity, issuer, TLS version, cipher posture, and chain
              health findings.
            </li>
            <li>
              <code>dnsAnalysis</code> includes DNSSEC, CAA, SPF, DMARC, and DNS response-time posture with findings.
            </li>
          </ul>
          <p className="mt-4 text-xs uppercase tracking-[0.14em] text-slate-500">Sample response</p>
          <CodeBlock code={CHECK_RESPONSE_EXAMPLE} />
        </EndpointCard>

        <EndpointCard
          method="GET / POST / DELETE"
          path="/api/webhooks"
          auth="Required (session)"
          summary="Manage outbound webhook destinations for grade-change events."
        >
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <code>GET</code> returns <code>{`{ webhooks: [...] }`}</code>
            </li>
            <li>
              <code>POST</code> expects <code>{`{ "url": "https://hooks.example.com" }`}</code>
            </li>
            <li>
              <code>DELETE</code> accepts webhook <code>id</code> in query string or JSON body
            </li>
            <li>
              Slack Incoming Webhook URLs and Discord webhook URLs are auto-detected and receive provider-native
              payloads.
            </li>
            <li>All other webhook URLs receive the generic JSON grade-change payload shown below.</li>
          </ul>
          <CodeBlock code={WEBHOOK_CREATE_EXAMPLE} />
          <p className="mt-4 text-xs uppercase tracking-[0.14em] text-slate-500">Generic payload</p>
          <CodeBlock code={WEBHOOK_GENERIC_PAYLOAD_EXAMPLE} />
          <p className="mt-4 text-xs uppercase tracking-[0.14em] text-slate-500">Slack payload shape</p>
          <CodeBlock code={WEBHOOK_SLACK_PAYLOAD_EXAMPLE} />
          <p className="mt-4 text-xs uppercase tracking-[0.14em] text-slate-500">Discord payload shape</p>
          <CodeBlock code={WEBHOOK_DISCORD_PAYLOAD_EXAMPLE} />
        </EndpointCard>

        <EndpointCard
          method="POST"
          path="/api/webhooks/test"
          auth="Required (session)"
          summary="Send a test grade-change event to a saved webhook id or a raw webhook URL."
        >
          <p>
            Body accepts either <code>{`{ "id": "<saved-webhook-id>" }`}</code> or{" "}
            <code>{`{ "url": "https://..." }`}</code>. Useful for validating Slack/Discord destinations before waiting
            for a scheduled watchlist grade change.
          </p>
          <CodeBlock code={WEBHOOK_TEST_EXAMPLE} />
        </EndpointCard>

        <EndpointCard
          method="GET / PUT / DELETE"
          path="/api/user-data"
          auth="Required (session)"
          summary="Read and update account-level settings, history, watchlist preferences, and notification state."
        >
          <p>
            <code>PUT</code> accepts partial updates (for example: <code>watchlist</code>, <code>scanHistory</code>,{" "}
            <code>comparisonHistory</code>, <code>alertEmail</code>, <code>notificationFrequency</code>,{" "}
            <code>webhooks</code>, and related settings).
          </p>
        </EndpointCard>

        <EndpointCard
          method="GET / POST / DELETE"
          path="/api/api-key"
          auth="Required (session)"
          summary="Retrieve, generate/regenerate, or revoke your personal API key used for /api/check."
        >
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <code>GET</code>: <code>{`{ apiKey, hasApiKey }`}</code>
            </li>
            <li>
              <code>POST</code>: <code>{`{ apiKey, generated: true }`}</code>
            </li>
            <li>
              <code>DELETE</code>: <code>{`{ revoked: true, apiKey: null }`}</code>
            </li>
          </ul>
        </EndpointCard>

        <EndpointCard
          method="POST"
          path="/api/watchlist-notifications"
          auth="Required (session)"
          summary="Trigger immediate grade-change email checks against a user watchlist entry."
        >
          <p>
            Body fields: <code>url</code>, <code>previousGrade</code>, <code>currentGrade</code>, <code>checkedAt</code>{" "}
            (ISO timestamp).
          </p>
        </EndpointCard>

        <EndpointCard
          method="GET / POST"
          path="/api/cron/watchlist-scan"
          auth="Cron secret (or Vercel cron)"
          summary="Scheduled watchlist scanner that updates grades and sends email/webhook notifications."
        >
          <p>
            Returns aggregate totals for users scanned, grade changes, deliveries, failures, and warning messages for
            observability.
          </p>
          <CodeBlock code={CRON_EXAMPLE} />
        </EndpointCard>

        <EndpointCard
          method="GET"
          path="/api/badge/[domain]"
          auth="None"
          summary="Render a live SVG badge for a domain’s current security-header grade."
        >
          <p>
            Query params: <code>style=flat</code> (default) or <code>style=flat-square</code>.
          </p>
          <CodeBlock code={BADGE_EXAMPLE} />
        </EndpointCard>

        <EndpointCard
          method="GET"
          path="/api/og"
          auth="None"
          summary="Generate Open Graph images for dynamic social previews."
        >
          <p>
            Optional query parameters: <code>title</code> and <code>description</code>.
          </p>
        </EndpointCard>
      </section>

      <p className="mt-6 text-sm text-slate-300">
        Need automation examples?{" "}
        <Link href="/docs/ci-cd" className="text-sky-300 transition hover:text-sky-200">
          Open the CI/CD guide
        </Link>
        . Prefer a broader docs overview?{" "}
        <Link href="/docs" className="text-sky-300 transition hover:text-sky-200">
          Visit the docs hub
        </Link>
        .
      </p>

      <SiteFooter className="mt-10" />
    </main>
  );
}
