"use client";

import { Fragment, useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { HEADER_GUIDANCE } from "@/lib/headerGuidance";
import type { DetectedFramework } from "@/lib/frameworkDetection";
import type { HeaderResult } from "@/lib/securityHeaders";

type FixFrameworkId = "nextjs" | "express" | "nginx" | "apache" | "vercel" | "cloudflare";
type SnippetLanguage = "typescript" | "javascript" | "nginx" | "apache" | "json" | "html";
type CopyState = "idle" | "error" | FixFrameworkId | "csp-meta";

type FrameworkSnippet = {
  id: FixFrameworkId;
  label: string;
  description: string;
  language: SnippetLanguage;
  snippet: string;
};

type SupplementalSnippet = {
  id: "csp-meta";
  title: string;
  description: string;
  language: SnippetLanguage;
  snippet: string;
};

type FixSuggestionProps = {
  header: HeaderResult;
  detectedFramework?: DetectedFramework | null;
};

const FRAMEWORK_META: Record<FixFrameworkId, Pick<FrameworkSnippet, "label" | "description">> = {
  nextjs: {
    label: "Next.js",
    description: "Use middleware to set response headers on every route."
  },
  express: {
    label: "Express",
    description: "Use helmet or a small middleware for consistent header coverage."
  },
  nginx: {
    label: "Nginx",
    description: "Set headers in your server block and reload Nginx."
  },
  apache: {
    label: "Apache",
    description: "Set headers with mod_headers and reload Apache."
  },
  vercel: {
    label: "Vercel config",
    description: "Configure global headers in vercel.json."
  },
  cloudflare: {
    label: "Cloudflare",
    description: "Set headers at the edge with a Worker."
  }
};

const FRAMEWORK_ORDER: FixFrameworkId[] = ["nextjs", "express", "nginx", "apache", "vercel", "cloudflare"];
const guidanceByKey = new Map(HEADER_GUIDANCE.map((item) => [item.key, item]));

const KEYWORDS_BY_LANGUAGE: Partial<Record<SnippetLanguage, string[]>> = {
  typescript: [
    "import",
    "from",
    "export",
    "default",
    "const",
    "let",
    "return",
    "async",
    "await",
    "if",
    "for",
    "new",
    "function",
    "true",
    "false"
  ],
  javascript: [
    "import",
    "from",
    "export",
    "default",
    "const",
    "let",
    "return",
    "async",
    "await",
    "if",
    "for",
    "new",
    "function",
    "true",
    "false"
  ],
  nginx: ["server", "location", "add_header"],
  apache: ["Header", "always", "set"],
  json: [],
  html: ["meta", "http-equiv", "content"]
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenizeLine(line: string, language: SnippetLanguage): Array<{ kind: string; value: string }> {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("//") || trimmed.startsWith("#")) {
    return [{ kind: "comment", value: line }];
  }

  const tokens: Array<{ kind: string; value: string }> = [];
  let buffer = "";
  let index = 0;

  while (index < line.length) {
    const char = line[index];
    if (char === '"' || char === "'" || char === "`") {
      if (buffer) {
        tokens.push({ kind: "plain", value: buffer });
        buffer = "";
      }
      const quote = char;
      let stringToken = char;
      index += 1;
      while (index < line.length) {
        const current = line[index];
        stringToken += current;
        if (current === quote && line[index - 1] !== "\\") {
          break;
        }
        index += 1;
      }
      tokens.push({ kind: "string", value: stringToken });
      index += 1;
      continue;
    }

    buffer += char;
    index += 1;
  }

  if (buffer) {
    tokens.push({ kind: "plain", value: buffer });
  }

  const keywords = KEYWORDS_BY_LANGUAGE[language] ?? [];
  if (keywords.length === 0) {
    return tokens;
  }

  const keywordPattern = new RegExp(`\\b(${keywords.map(escapeRegex).join("|")})\\b`, "g");
  const highlighted: Array<{ kind: string; value: string }> = [];

  for (const token of tokens) {
    if (token.kind !== "plain") {
      highlighted.push(token);
      continue;
    }

    let cursor = 0;
    for (const match of token.value.matchAll(keywordPattern)) {
      const keyword = match[0];
      const start = match.index ?? 0;
      if (start > cursor) {
        highlighted.push({ kind: "plain", value: token.value.slice(cursor, start) });
      }
      highlighted.push({ kind: "keyword", value: keyword });
      cursor = start + keyword.length;
    }
    if (cursor < token.value.length) {
      highlighted.push({ kind: "plain", value: token.value.slice(cursor) });
    }
  }

  return highlighted;
}

function renderHighlightedCode(code: string, language: SnippetLanguage): ReactNode {
  const lines = code.split("\n");

  return (
    <code className="block whitespace-pre">
      {lines.map((line, lineIndex) => (
        <Fragment key={`${line}-${lineIndex}`}>
          {tokenizeLine(line, language).map((token, tokenIndex) => (
            <span
              key={`${token.value}-${tokenIndex}`}
              className={
                token.kind === "comment"
                  ? "text-slate-500"
                  : token.kind === "string"
                    ? "text-amber-300"
                    : token.kind === "keyword"
                      ? "text-sky-300"
                      : "text-slate-200"
              }
            >
              {token.value}
            </span>
          ))}
          {lineIndex < lines.length - 1 ? "\n" : ""}
        </Fragment>
      ))}
    </code>
  );
}

function getDetectedFramework(framework: DetectedFramework | null | undefined): FixFrameworkId | null {
  if (!framework) return null;
  if (framework.id === "nextjs") return "nextjs";
  if (framework.id === "express") return "express";
  if (framework.id === "nginx") return "nginx";
  if (framework.id === "apache") return "apache";
  if (framework.id === "cloudflare-workers") return "cloudflare";
  return null;
}

function getHeaderRecommendation(header: HeaderResult) {
  const guidance = guidanceByKey.get(header.key);
  return {
    headerName: guidance?.headerName ?? header.label,
    recommendedValue: guidance?.recommendedValue ?? header.guidance
  };
}

function createGenericSnippet(header: HeaderResult, frameworkId: FixFrameworkId): FrameworkSnippet {
  const { headerName, recommendedValue } = getHeaderRecommendation(header);
  const meta = FRAMEWORK_META[frameworkId];

  if (frameworkId === "nextjs") {
    return {
      id: frameworkId,
      label: meta.label,
      description: meta.description,
      language: "typescript",
      snippet: `// app/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(_request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("${headerName}", "${recommendedValue}");
  return response;
}

export const config = {
  matcher: "/:path*"
};`
    };
  }

  if (frameworkId === "express") {
    return {
      id: frameworkId,
      label: meta.label,
      description: meta.description,
      language: "javascript",
      snippet: `// app.js
app.use((_req, res, next) => {
  res.setHeader("${headerName}", "${recommendedValue}");
  next();
});`
    };
  }

  if (frameworkId === "nginx") {
    return {
      id: frameworkId,
      label: meta.label,
      description: meta.description,
      language: "nginx",
      snippet: `# nginx.conf (inside server {})
add_header ${headerName} "${recommendedValue}" always;`
    };
  }

  if (frameworkId === "apache") {
    return {
      id: frameworkId,
      label: meta.label,
      description: meta.description,
      language: "apache",
      snippet: `# .htaccess or Apache vhost (mod_headers)
Header always set ${headerName} "${recommendedValue}"`
    };
  }

  if (frameworkId === "vercel") {
    return {
      id: frameworkId,
      label: meta.label,
      description: meta.description,
      language: "json",
      snippet: `{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "${headerName}", "value": "${recommendedValue}" }
      ]
    }
  ]
}`
    };
  }

  return {
    id: frameworkId,
    label: meta.label,
    description: meta.description,
    language: "typescript",
    snippet: `// Cloudflare Worker
export default {
  async fetch(request: Request) {
    const upstream = await fetch(request);
    const headers = new Headers(upstream.headers);
    headers.set("${headerName}", "${recommendedValue}");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers
    });
  }
};`
  };
}

function createCspSnippet(frameworkId: FixFrameworkId): FrameworkSnippet {
  const cspValue =
    guidanceByKey.get("content-security-policy")?.recommendedValue ??
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none';";
  const meta = FRAMEWORK_META[frameworkId];

  if (frameworkId === "express") {
    return {
      id: frameworkId,
      label: meta.label,
      description: "Use Helmet to enforce CSP and legacy clickjacking protection in one place.",
      language: "javascript",
      snippet: `import helmet from "helmet";

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"]
      }
    },
    frameguard: { action: "deny" }
  })
);`
    };
  }

  return createGenericSnippet(
    {
      key: "content-security-policy",
      label: "Content-Security-Policy",
      value: null,
      present: false,
      status: "missing",
      riskLevel: "high",
      whyItMatters: "",
      guidance: cspValue
    },
    frameworkId
  );
}

function createHstsSnippet(frameworkId: FixFrameworkId): FrameworkSnippet {
  const hstsValue =
    guidanceByKey.get("strict-transport-security")?.recommendedValue ??
    "max-age=31536000; includeSubDomains; preload";
  return createGenericSnippet(
    {
      key: "strict-transport-security",
      label: "Strict-Transport-Security",
      value: null,
      present: false,
      status: "missing",
      riskLevel: "high",
      whyItMatters: "",
      guidance: hstsValue
    },
    frameworkId
  );
}

function createXFrameOptionsSnippet(frameworkId: FixFrameworkId): FrameworkSnippet {
  const xfoValue = guidanceByKey.get("x-frame-options")?.recommendedValue ?? "DENY";
  const meta = FRAMEWORK_META[frameworkId];

  if (frameworkId === "nextjs") {
    return {
      id: frameworkId,
      label: meta.label,
      description: "Set X-Frame-Options and pair it with CSP frame-ancestors for modern browsers.",
      language: "typescript",
      snippet: `// app/middleware.ts
import { NextResponse } from "next/server";

export function middleware() {
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "${xfoValue}");
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none';");
  return response;
}

export const config = {
  matcher: "/:path*"
};`
    };
  }

  if (frameworkId === "express") {
    return {
      id: frameworkId,
      label: meta.label,
      description: "Helmet frameguard handles legacy browsers; CSP frame-ancestors is the modern control.",
      language: "javascript",
      snippet: `import helmet from "helmet";

app.use(
  helmet({
    frameguard: { action: "deny" },
    contentSecurityPolicy: {
      directives: {
        frameAncestors: ["'none'"]
      }
    }
  })
);`
    };
  }

  if (frameworkId === "nginx") {
    return {
      id: frameworkId,
      label: meta.label,
      description: meta.description,
      language: "nginx",
      snippet: `# nginx.conf (inside server {})
add_header X-Frame-Options "${xfoValue}" always;
add_header Content-Security-Policy "frame-ancestors 'none';" always;`
    };
  }

  if (frameworkId === "apache") {
    return {
      id: frameworkId,
      label: meta.label,
      description: meta.description,
      language: "apache",
      snippet: `# .htaccess or Apache vhost (mod_headers)
Header always set X-Frame-Options "${xfoValue}"
Header always set Content-Security-Policy "frame-ancestors 'none';"`
    };
  }

  if (frameworkId === "vercel") {
    return {
      id: frameworkId,
      label: meta.label,
      description: meta.description,
      language: "json",
      snippet: `{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "${xfoValue}" },
        { "key": "Content-Security-Policy", "value": "frame-ancestors 'none';" }
      ]
    }
  ]
}`
    };
  }

  return {
    id: frameworkId,
    label: meta.label,
    description: meta.description,
    language: "typescript",
    snippet: `// Cloudflare Worker
export default {
  async fetch(request: Request) {
    const upstream = await fetch(request);
    const headers = new Headers(upstream.headers);
    headers.set("X-Frame-Options", "${xfoValue}");
    headers.set("Content-Security-Policy", "frame-ancestors 'none';");

    return new Response(upstream.body, { status: upstream.status, headers });
  }
};`
  };
}

function getFrameworkSnippet(header: HeaderResult, frameworkId: FixFrameworkId): FrameworkSnippet {
  if (header.key === "content-security-policy") {
    return createCspSnippet(frameworkId);
  }
  if (header.key === "strict-transport-security") {
    return createHstsSnippet(frameworkId);
  }
  if (header.key === "x-frame-options") {
    return createXFrameOptionsSnippet(frameworkId);
  }
  return createGenericSnippet(header, frameworkId);
}

function getSupplementalSnippet(header: HeaderResult): SupplementalSnippet | null {
  if (header.key !== "content-security-policy") return null;
  const cspValue =
    guidanceByKey.get("content-security-policy")?.recommendedValue ??
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none';";
  return {
    id: "csp-meta",
    title: "Quick HTML fallback (CSP meta tag)",
    description:
      "Useful for static pages while rolling out headers. Prefer response headers for full CSP support.",
    language: "html",
    snippet: `<meta
  http-equiv="Content-Security-Policy"
  content="${cspValue}"
/>`
  };
}

function getHeaderNotes(header: HeaderResult): string[] {
  if (header.key === "strict-transport-security") {
    return [
      "Use max-age >= 31536000 (1 year) and includeSubDomains for baseline hardening.",
      "Add preload only after confirming every subdomain serves valid HTTPS."
    ];
  }
  if (header.key === "x-frame-options") {
    return ["Keep X-Frame-Options for legacy support, and use CSP frame-ancestors as the modern control."];
  }
  if (header.key === "content-security-policy") {
    return ["Avoid unsafe-inline and unsafe-eval in production. Introduce nonces or hashes when needed."];
  }
  return [];
}

function stopCardEvents(event: MouseEvent | KeyboardEvent) {
  event.stopPropagation();
}

function CodeSnippet({
  code,
  language
}: {
  code: string;
  language: SnippetLanguage;
}) {
  return (
    <pre className="max-h-72 overflow-auto rounded-lg border border-slate-800 bg-slate-950/90 p-3 text-xs leading-relaxed">
      {renderHighlightedCode(code, language)}
    </pre>
  );
}

export function FixSuggestion({ header, detectedFramework }: FixSuggestionProps) {
  const [open, setOpen] = useState(false);
  const [expandedFramework, setExpandedFramework] = useState<FixFrameworkId | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const detected = useMemo(() => getDetectedFramework(detectedFramework), [detectedFramework]);
  const frameworkSnippets = useMemo(() => {
    const ordered = [...FRAMEWORK_ORDER];
    if (detected) {
      ordered.sort((a, b) => {
        if (a === detected) return -1;
        if (b === detected) return 1;
        return 0;
      });
    }
    return ordered.map((id) => getFrameworkSnippet(header, id));
  }, [header, detected]);
  const supplementalSnippet = useMemo(() => getSupplementalSnippet(header), [header]);
  const headerNotes = useMemo(() => getHeaderNotes(header), [header]);

  useEffect(() => {
    setOpen(false);
    setCopyState("idle");
    setExpandedFramework(detected ?? FRAMEWORK_ORDER[0]);
  }, [header.key, header.status, detected]);

  if (header.status === "good") {
    return null;
  }

  async function handleCopy(target: Exclude<CopyState, "idle" | "error">, snippet: string) {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopyState(target);
    } catch {
      setCopyState("error");
    } finally {
      window.setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  return (
    <section
      className="mt-4 rounded-xl border border-slate-800/90 bg-slate-950/70"
      onClick={stopCardEvents}
      onKeyDown={stopCardEvents}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Toggle fix suggestions for ${header.label}`}
        onClick={(event) => {
          stopCardEvents(event);
          setOpen((current) => !current);
        }}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-slate-900/60"
      >
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">How to fix</span>
        <span className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-800/90 px-3 py-3">
          {detectedFramework && detected && (
            <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
              Detected stack: <span className="font-semibold">{detectedFramework.label}</span>. That option is listed
              first below.
            </p>
          )}

          {headerNotes.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
              {headerNotes.map((note) => (
                <li key={note}>• {note}</li>
              ))}
            </ul>
          )}

          {supplementalSnippet && (
            <article className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-200">
                    {supplementalSnippet.title}
                  </h4>
                  <p className="mt-1 text-xs text-slate-400">{supplementalSnippet.description}</p>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    stopCardEvents(event);
                    void handleCopy(supplementalSnippet.id, supplementalSnippet.snippet);
                  }}
                  className="rounded-md border border-slate-700 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
                >
                  {copyState === supplementalSnippet.id ? "Copied" : "Copy"}
                </button>
              </div>
              <CodeSnippet code={supplementalSnippet.snippet} language={supplementalSnippet.language} />
            </article>
          )}

          <div className="space-y-2">
            {frameworkSnippets.map((framework) => {
              const expanded = expandedFramework === framework.id;
              return (
                <article key={framework.id} className="rounded-lg border border-slate-800 bg-slate-900/60">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={(event) => {
                      stopCardEvents(event);
                      setExpandedFramework((current) => (current === framework.id ? null : framework.id));
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-100">{framework.label}</p>
                      <p className="text-xs text-slate-400">{framework.description}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {framework.id === detected && (
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-sky-300">Detected</p>
                      )}
                      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{expanded ? "Hide" : "Show"}</p>
                    </div>
                  </button>

                  {expanded && (
                    <div className="space-y-2 border-t border-slate-800 px-3 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={(event) => {
                            stopCardEvents(event);
                            void handleCopy(framework.id, framework.snippet);
                          }}
                          className="rounded-md border border-slate-700 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
                        >
                          {copyState === framework.id ? "Copied" : "Copy snippet"}
                        </button>
                      </div>
                      <CodeSnippet code={framework.snippet} language={framework.language} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {copyState === "error" && (
            <p className="text-xs text-rose-300">Clipboard unavailable in this browser context. Copy manually.</p>
          )}
        </div>
      )}
    </section>
  );
}
