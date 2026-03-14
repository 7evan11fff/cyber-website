import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "CI/CD Integration Guide",
  description:
    "Copy-ready CI/CD examples for running Security Header Checker in GitHub Actions, GitLab CI, and generic shell pipelines.",
  path: "/docs/ci-cd"
});

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <code>{code}</code>
    </pre>
  );
}

const CURL_WITH_JQ_EXAMPLE = `#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="\${API_BASE_URL:-https://security-header-checker.vercel.app}"
TARGET_URL="\${TARGET_URL:-https://example.com}"
MIN_GRADE="\${MIN_GRADE:-B}"
API_KEY="\${SECURITY_HEADERS_API_KEY:-}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for CI parsing." >&2
  exit 2
fi

AUTH_HEADER=()
if [ -n "$API_KEY" ]; then
  AUTH_HEADER=(-H "Authorization: Bearer $API_KEY")
fi

report_json="$(curl -fsS "$API_BASE_URL/api/check" \\
  -X POST \\
  -H "Content-Type: application/json" \\
  "\${AUTH_HEADER[@]}" \\
  -d "{\\"url\\":\\"$TARGET_URL\\"}")"

grade="$(echo "$report_json" | jq -r '.grade // empty')"
score="$(echo "$report_json" | jq -r '.score // empty')"

if [ -z "$grade" ]; then
  echo "Scan failed: $report_json" >&2
  exit 1
fi

grade_rank() {
  case "$1" in
    A) echo 5 ;;
    B) echo 4 ;;
    C) echo 3 ;;
    D) echo 2 ;;
    F) echo 1 ;;
    *) echo 0 ;;
  esac
}

if [ "$(grade_rank "$grade")" -lt "$(grade_rank "$MIN_GRADE")" ]; then
  echo "Security header gate failed: grade=$grade score=$score (min=$MIN_GRADE)." >&2
  exit 1
fi

echo "Security header gate passed: grade=$grade score=$score."`;

const GITHUB_ACTIONS_EXAMPLE = `name: Security Header Gate

on:
  pull_request:
  push:
    branches: [main]

jobs:
  security-headers:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check security headers
        env:
          API_BASE_URL: https://security-header-checker.vercel.app
          TARGET_URL: https://example.com
          MIN_GRADE: B
          SECURITY_HEADERS_API_KEY: \${{ secrets.SECURITY_HEADERS_API_KEY }}
        run: |
          bash ./scripts/security-header-gate.sh`;

const GITLAB_CI_EXAMPLE = `stages:
  - test

security_headers_gate:
  stage: test
  image: alpine:3.21
  variables:
    API_BASE_URL: "https://security-header-checker.vercel.app"
    TARGET_URL: "https://example.com"
    MIN_GRADE: "B"
  before_script:
    - apk add --no-cache bash curl jq
  script:
    - SECURITY_HEADERS_API_KEY="$SECURITY_HEADERS_API_KEY" bash ./scripts/security-header-gate.sh
  only:
    - merge_requests
    - main`;

const GENERIC_SCRIPT_EXAMPLE = `# Example for Jenkins, CircleCI, Buildkite, etc.
export API_BASE_URL="https://security-header-checker.vercel.app"
export TARGET_URL="https://example.com"
export MIN_GRADE="B"
export SECURITY_HEADERS_API_KEY="<your-api-key-from-settings>"

bash ./scripts/security-header-gate.sh`;

export default function CiCdDocsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />

      <section className="mb-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <h1 className="text-3xl font-semibold text-slate-100 sm:text-4xl">CI/CD integration guide</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Use this page to gate pull requests and deployments when a target domain&apos;s security-header grade falls
          below your minimum threshold.
        </p>
      </section>

      <section className="space-y-5 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Step 1</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-100">Use /api/check with curl + jq</h2>
          <p className="mt-2 text-sm text-slate-300">
            This script calls <code>/api/check</code>, parses the returned grade using <code>jq</code>, and exits
            non-zero when the grade is lower than your threshold.
          </p>
          <CodeBlock code={CURL_WITH_JQ_EXAMPLE} />
        </article>

        <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Step 2</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-100">GitHub Actions workflow</h2>
          <p className="mt-2 text-sm text-slate-300">
            Run on pull requests and pushes to main. The job fails automatically when the script exits with code 1.
          </p>
          <CodeBlock code={GITHUB_ACTIONS_EXAMPLE} />
        </article>

        <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Step 3</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-100">GitLab CI example</h2>
          <p className="mt-2 text-sm text-slate-300">
            Works in merge requests and main branch pipelines. Ensure <code>SECURITY_HEADERS_API_KEY</code> is set in
            CI variables.
          </p>
          <CodeBlock code={GITLAB_CI_EXAMPLE} />
        </article>

        <article className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Step 4</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-100">Generic shell usage</h2>
          <p className="mt-2 text-sm text-slate-300">
            Use the same shell gate in Jenkins, CircleCI, Buildkite, Azure Pipelines, or any runner that supports
            Bash.
          </p>
          <CodeBlock code={GENERIC_SCRIPT_EXAMPLE} />
        </article>
      </section>

      <p className="mt-6 text-sm text-slate-300">
        Need endpoint details first?{" "}
        <Link href="/docs/api" className="text-sky-300 transition hover:text-sky-200">
          Return to API docs
        </Link>
        . Generate your API key in{" "}
        <Link href="/settings" className="text-sky-300 transition hover:text-sky-200">
          Settings - Integrations
        </Link>
        .
      </p>

      <SiteFooter className="mt-10" />
    </main>
  );
}
