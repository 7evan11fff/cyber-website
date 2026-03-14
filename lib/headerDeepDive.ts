import type { HeaderResult } from "@/lib/securityHeaders";

export type HeaderDirectiveExplanation = {
  directive: string;
  raw: string;
  explanation: string;
};

export type HeaderDeepDiveDetails = {
  mdnUrl: string;
  directives: HeaderDirectiveExplanation[];
};

const MDN_DOCS_BY_HEADER: Record<string, string> = {
  "content-security-policy": "https://developer.mozilla.org/docs/Web/HTTP/Headers/Content-Security-Policy",
  "strict-transport-security": "https://developer.mozilla.org/docs/Web/HTTP/Headers/Strict-Transport-Security",
  "x-frame-options": "https://developer.mozilla.org/docs/Web/HTTP/Headers/X-Frame-Options",
  "x-xss-protection": "https://developer.mozilla.org/docs/Web/HTTP/Headers/X-XSS-Protection",
  "x-content-type-options": "https://developer.mozilla.org/docs/Web/HTTP/Headers/X-Content-Type-Options",
  "referrer-policy": "https://developer.mozilla.org/docs/Web/HTTP/Headers/Referrer-Policy",
  "feature-policy": "https://developer.mozilla.org/docs/Web/HTTP/Headers/Feature-Policy",
  "permissions-policy": "https://developer.mozilla.org/docs/Web/HTTP/Headers/Permissions-Policy",
  "cross-origin-opener-policy": "https://developer.mozilla.org/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy",
  "cross-origin-embedder-policy": "https://developer.mozilla.org/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy",
  "cross-origin-resource-policy": "https://developer.mozilla.org/docs/Web/HTTP/Headers/Cross-Origin-Resource-Policy"
};

const DIRECTIVE_EXPLANATIONS: Record<string, Record<string, string>> = {
  "content-security-policy": {
    "default-src": "Fallback source list used when a more specific *-src directive is not set.",
    "script-src": "Defines where JavaScript can be loaded from.",
    "style-src": "Defines where CSS styles can be loaded from.",
    "img-src": "Defines where image resources can be loaded from.",
    "connect-src": "Defines allowed endpoints for fetch/XHR/WebSocket/EventSource requests.",
    "font-src": "Defines where font files can be loaded from.",
    "frame-src": "Defines which sources can be embedded in frames/iframes.",
    "frame-ancestors": "Controls which parent pages are allowed to embed this page.",
    "object-src": "Controls allowed plugins/embedded objects; usually set to 'none'.",
    "base-uri": "Restricts which <base> URLs are allowed.",
    "form-action": "Restricts where forms on this page are allowed to submit.",
    "upgrade-insecure-requests": "Asks the browser to upgrade HTTP subresource requests to HTTPS.",
    sandbox: "Applies sandbox restrictions similar to iframe sandbox behavior.",
    "report-uri": "Legacy endpoint for CSP violation reports.",
    "report-to": "Modern reporting group target for CSP violations."
  },
  "strict-transport-security": {
    "max-age": "How long (in seconds) the browser should force HTTPS for this host.",
    includesubdomains: "Applies HSTS rules to all subdomains too.",
    preload: "Signals intent to be included in browser preload lists."
  },
  "x-frame-options": {
    deny: "Prevents this page from being embedded in any frame.",
    sameorigin: "Allows framing only by pages from the same origin.",
    "allow-from": "Legacy token; support is limited and generally discouraged."
  },
  "x-xss-protection": {
    "0": "Disables legacy reflective XSS filtering.",
    "1": "Enables legacy reflective XSS filtering.",
    mode: "mode=block asks compatible browsers to block rendering on detected attacks."
  },
  "x-content-type-options": {
    nosniff: "Stops browsers from MIME-sniffing and forces declared content types."
  },
  "referrer-policy": {
    "no-referrer": "Never send referrer information.",
    "strict-origin": "Send only origin and only over equally secure HTTPS requests.",
    "strict-origin-when-cross-origin":
      "Send full referrer on same-origin requests, origin-only cross-origin, and nothing on downgrades.",
    "same-origin": "Send referrer only for same-origin requests.",
    "origin-when-cross-origin": "Send full referrer same-origin and origin-only cross-origin.",
    origin: "Send only the origin for all requests.",
    "unsafe-url": "Always sends full URL referrer, including path/query."
  },
  "cross-origin-opener-policy": {
    "same-origin": "Fully isolates the browsing context group to same-origin pages.",
    "same-origin-allow-popups":
      "Keeps opener references for allowed popups while still isolating main browsing context.",
    "unsafe-none": "Disables COOP isolation behavior."
  },
  "cross-origin-embedder-policy": {
    "require-corp": "Requires embedded cross-origin resources to explicitly allow embedding.",
    credentialless: "Allows embedding without credentials for certain cross-origin resources.",
    "unsafe-none": "No embedder isolation is enforced."
  },
  "cross-origin-resource-policy": {
    "same-origin": "Only same-origin pages can load this resource.",
    "same-site": "Resources can be loaded by same-site origins.",
    "cross-origin": "Any origin can load this resource."
  }
};

function splitDirectives(headerKey: string, value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (headerKey === "permissions-policy") {
    return trimmed
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  if (
    headerKey === "content-security-policy" ||
    headerKey === "strict-transport-security" ||
    headerKey === "feature-policy" ||
    headerKey === "x-xss-protection"
  ) {
    return trimmed
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [trimmed];
}

function directiveNameFromToken(headerKey: string, token: string): string {
  const normalized = token.trim().toLowerCase();
  if (!normalized) return "";

  if (headerKey === "permissions-policy") {
    return normalized.split("=")[0]?.trim() ?? normalized;
  }

  if (headerKey === "content-security-policy" || headerKey === "feature-policy") {
    return normalized.split(/\s+/)[0] ?? normalized;
  }

  if (headerKey === "strict-transport-security" || headerKey === "x-xss-protection") {
    return normalized.split("=")[0]?.trim() ?? normalized;
  }

  return normalized;
}

function fallbackDirectiveExplanation(headerKey: string, directive: string): string {
  if (headerKey === "permissions-policy" || headerKey === "feature-policy") {
    return `Controls whether "${directive}" is allowed for this page context.`;
  }
  if (headerKey === "content-security-policy") {
    return `This CSP directive configures allowed behavior for "${directive}".`;
  }
  return "This token configures behavior for this security header.";
}

function explainDirective(headerKey: string, directive: string): string {
  const keyExplanations = DIRECTIVE_EXPLANATIONS[headerKey];
  if (keyExplanations && keyExplanations[directive]) {
    return keyExplanations[directive];
  }
  return fallbackDirectiveExplanation(headerKey, directive);
}

export function getHeaderDeepDiveDetails(header: HeaderResult): HeaderDeepDiveDetails {
  const mdnUrl =
    MDN_DOCS_BY_HEADER[header.key] ?? "https://developer.mozilla.org/docs/Web/HTTP/Headers";

  if (!header.value) {
    return {
      mdnUrl,
      directives: [
        {
          directive: "Missing header",
          raw: "",
          explanation:
            "No header value was detected in the response. Add this header at your edge/server config level."
        }
      ]
    };
  }

  const tokens = splitDirectives(header.key, header.value);
  const directives = tokens.map((token) => {
    const directive = directiveNameFromToken(header.key, token);
    return {
      directive: directive || "value",
      raw: token,
      explanation: explainDirective(header.key, directive || "value")
    };
  });

  return {
    mdnUrl,
    directives
  };
}
