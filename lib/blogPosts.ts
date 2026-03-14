export type BlogSection = {
  heading: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  publishedAt: string;
  readingTime: string;
  tags: readonly string[];
  sections: readonly BlogSection[];
};

const BLOG_POSTS: readonly BlogPost[] = [
  {
    slug: "why-csp-matters",
    title: "Why CSP Matters",
    description:
      "Understand how Content-Security-Policy limits script injection, reduces XSS blast radius, and protects modern web apps.",
    excerpt:
      "Content-Security-Policy is still one of the highest-impact headers for reducing XSS risk when configured with nonces or hashes.",
    publishedAt: "2026-03-12",
    readingTime: "4 min read",
    tags: ["CSP", "XSS", "Security headers"],
    sections: [
      {
        heading: "CSP is your browser-side guardrail",
        paragraphs: [
          "A strong Content-Security-Policy (CSP) tells the browser exactly which script and resource sources are trusted. If malicious inline JavaScript appears, the browser can block it before execution.",
          "CSP does not replace secure coding, but it adds a powerful second layer that significantly reduces the impact of reflected and stored XSS issues."
        ]
      },
      {
        heading: "Start with a practical rollout",
        paragraphs: [
          "Teams often get stuck trying to design the perfect policy immediately. A better approach is to start in report-only mode, gather violation telemetry, and then tighten the policy over time.",
          "Use nonces or hashes for scripts, avoid broad wildcards, and review third-party domains regularly so your policy stays intentional."
        ],
        bullets: [
          "Prefer nonce-based script execution rules",
          "Enable report-only first to avoid breaking production",
          "Review violations weekly and remove unused sources"
        ]
      }
    ]
  },
  {
    slug: "hsts-best-practices",
    title: "HSTS Best Practices",
    description:
      "How to deploy Strict-Transport-Security safely, prevent protocol downgrade attacks, and prepare for preload submission.",
    excerpt:
      "HSTS helps enforce HTTPS-only access and prevents SSL stripping, but safe rollout requires deliberate max-age and subdomain planning.",
    publishedAt: "2026-03-10",
    readingTime: "5 min read",
    tags: ["HSTS", "HTTPS", "Transport security"],
    sections: [
      {
        heading: "Why HSTS is still essential",
        paragraphs: [
          "Strict-Transport-Security (HSTS) tells browsers to always use HTTPS for your domain. Once cached, the browser upgrades future requests automatically and blocks insecure HTTP access.",
          "This directly reduces risk from downgrade and SSL stripping attacks on untrusted networks."
        ]
      },
      {
        heading: "Roll out safely and intentionally",
        paragraphs: [
          "Begin with a lower max-age and increase it as you confirm all hosts, redirects, and certificates are stable.",
          "Only add includeSubDomains when every subdomain is HTTPS-ready, and submit to preload lists after you are confident your setup is durable."
        ],
        bullets: [
          "Ensure HTTP always redirects to HTTPS at the edge",
          "Use includeSubDomains only when all subdomains are compliant",
          "Target preload after operational confidence is high"
        ]
      }
    ]
  },
  {
    slug: "top-10-security-header-mistakes",
    title: "Top 10 Security Header Mistakes",
    description:
      "Common security header misconfigurations that weaken browser protections and how to avoid them in production.",
    excerpt:
      "From overly permissive CSP to missing frame protections, these mistakes appear in real audits and are usually quick to fix.",
    publishedAt: "2026-03-08",
    readingTime: "6 min read",
    tags: ["Best practices", "Hardening", "Misconfiguration"],
    sections: [
      {
        heading: "What goes wrong most often",
        paragraphs: [
          "Many sites technically send security headers but still leave critical gaps. Frequent issues include wildcard-heavy CSP, stale X-Frame-Options values, and missing HSTS on redirect responses.",
          "These mistakes usually happen when defaults are copied without validating how the app actually behaves."
        ],
        bullets: [
          "Using CSP with unsafe-inline and broad * source rules",
          "Adding HSTS before HTTPS coverage is complete",
          "Forgetting to test headers across CDN, app, and API paths",
          "Setting legacy headers while ignoring modern CSP/frame controls",
          "Treating one-time setup as done instead of continuous maintenance"
        ]
      },
      {
        heading: "Build a repeatable review loop",
        paragraphs: [
          "Security header quality improves when it is part of release hygiene. Include automated checks in CI and schedule recurring production scans so regressions are caught early.",
          "A lightweight dashboard or changelog of header changes helps teams understand risk shifts over time."
        ]
      }
    ]
  }
];

export function getAllBlogPosts(): readonly BlogPost[] {
  return BLOG_POSTS;
}

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
