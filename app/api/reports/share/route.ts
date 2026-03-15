import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { enforceApiRateLimit, withApiRateLimitHeaders } from "@/lib/apiRateLimit";
import { authOptions } from "@/lib/auth";
import type { SharedReportPayload } from "@/lib/reportShare";
import { buildSharedReportPath } from "@/lib/reportShare";
import { createSharedReport } from "@/lib/sharedReportsStore";
import { getUserKeyFromSessionUser } from "@/lib/userDataStore";

export const runtime = "nodejs";

const HEADER_RESULT_SCHEMA = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string().nullable(),
  present: z.boolean(),
  status: z.enum(["good", "weak", "missing"]),
  riskLevel: z.enum(["low", "medium", "high"]),
  whyItMatters: z.string(),
  guidance: z.string()
});

const COOKIE_RESULT_SCHEMA = z.object({
  name: z.string().min(1),
  raw: z.string().min(1),
  httpOnly: z.boolean(),
  secure: z.boolean(),
  sameSite: z.enum(["Strict", "Lax", "None", "Missing", "Invalid"]),
  path: z.string().nullable(),
  domain: z.string().nullable(),
  score: z.number().int().nonnegative().max(2),
  maxScore: z.literal(2),
  status: z.enum(["good", "weak", "missing"]),
  grade: z.string().min(1).max(8),
  findings: z.array(z.string().min(1)).max(10),
  guidance: z.array(z.string().min(1)).max(10)
});

const COOKIE_ANALYSIS_SCHEMA = z.object({
  cookies: z.array(COOKIE_RESULT_SCHEMA).max(60),
  cookieCount: z.number().int().nonnegative().max(60),
  score: z.number().int().nonnegative(),
  maxScore: z.number().int().nonnegative(),
  grade: z.string().min(1).max(8),
  summary: z.string().min(1).max(320)
});

const FRAMEWORK_SCHEMA = z.object({
  server: z.string().nullable(),
  poweredBy: z.string().nullable(),
  detected: z
    .object({
      id: z.enum(["nextjs", "express", "nginx", "apache", "cloudflare-workers", "nodejs"]),
      label: z.string().min(1).max(64),
      reason: z.string().min(1).max(240),
      evidence: z
        .array(
          z.object({
            header: z.string().min(1).max(64),
            value: z.string().min(1).max(240)
          })
        )
        .max(5)
    })
    .nullable()
});

const CORS_FINDING_SCHEMA = z.object({
  id: z.string().min(1).max(80),
  header: z.enum([
    "access-control-allow-origin",
    "access-control-allow-methods",
    "access-control-allow-headers",
    "access-control-allow-credentials"
  ]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  message: z.string().min(1).max(320),
  recommendation: z.string().min(1).max(400),
  value: z.string().nullable()
});

const CORS_ANALYSIS_SCHEMA = z.object({
  allowOrigin: z.string().nullable(),
  allowMethods: z.string().nullable(),
  allowHeaders: z.string().nullable(),
  allowCredentials: z.string().nullable(),
  allowsAnyOrigin: z.boolean(),
  allowsCredentials: z.boolean(),
  isOverlyPermissive: z.boolean(),
  score: z.number().int().nonnegative(),
  maxScore: z.number().int().nonnegative(),
  grade: z.string().min(1).max(8),
  findings: z.array(CORS_FINDING_SCHEMA).max(12),
  summary: z.string().min(1).max(500)
});

const TLS_FINDING_SCHEMA = z.object({
  id: z.string().min(1).max(80),
  severity: z.enum(["low", "medium", "high", "critical"]),
  message: z.string().min(1).max(320),
  recommendation: z.string().min(1).max(400),
  evidence: z.string().nullable()
});

const TLS_ANALYSIS_SCHEMA = z.object({
  available: z.boolean(),
  checkedHostname: z.string().nullable(),
  checkedPort: z.number().int().positive().nullable(),
  tlsVersion: z.string().nullable(),
  isInsecureTlsVersion: z.boolean(),
  prefersTls13: z.boolean(),
  cipherName: z.string().nullable(),
  cipherVersion: z.string().nullable(),
  weakAlgorithms: z.array(z.string().min(1).max(40)).max(5),
  issuer: z.string().nullable(),
  issuerCategory: z.string().min(1).max(80),
  subject: z.string().nullable(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  daysUntilExpiration: z.number().int().nullable(),
  certificateValid: z.boolean(),
  certificateExpired: z.boolean(),
  certificateExpiringSoon: z.boolean(),
  chainComplete: z.boolean(),
  chainLength: z.number().int().nonnegative(),
  selfSigned: z.boolean(),
  authorized: z.boolean(),
  authorizationError: z.string().nullable(),
  score: z.number().int().nonnegative(),
  maxScore: z.number().int().nonnegative(),
  grade: z.string().min(1).max(8),
  findings: z.array(TLS_FINDING_SCHEMA).max(12),
  summary: z.string().min(1).max(500)
});

const DNS_FINDING_SCHEMA = z.object({
  id: z.string().min(1).max(80),
  severity: z.enum(["low", "medium", "high", "critical"]),
  message: z.string().min(1).max(320),
  recommendation: z.string().min(1).max(400),
  evidence: z.string().nullable()
});

const DNS_ANALYSIS_SCHEMA = z.object({
  available: z.boolean(),
  checkedHostname: z.string().nullable(),
  dnssecStatus: z.enum(["configured", "not-configured", "unsupported", "unknown"]),
  hasCaa: z.boolean(),
  caaRecords: z.array(z.string().min(1).max(280)).max(20),
  spfRecord: z.string().nullable(),
  spfRecords: z.array(z.string().min(1).max(500)).max(8),
  spfPolicy: z.enum(["missing", "allow-all", "hard-fail", "soft-fail", "neutral", "missing-all"]),
  dmarcRecord: z.string().nullable(),
  dmarcRecords: z.array(z.string().min(1).max(500)).max(8),
  dmarcPolicy: z.enum(["missing", "none", "quarantine", "reject", "invalid"]),
  dmarcPct: z.number().int().min(0).max(100).nullable(),
  emailSecurityApplicable: z.boolean(),
  mxHosts: z.array(z.string().min(1).max(255)).max(25),
  responseTimes: z.object({
    lookupMs: z.number().int().nonnegative().nullable(),
    dnssecMs: z.number().int().nonnegative().nullable(),
    caaMs: z.number().int().nonnegative().nullable(),
    spfMs: z.number().int().nonnegative().nullable(),
    dmarcMs: z.number().int().nonnegative().nullable(),
    mxMs: z.number().int().nonnegative().nullable(),
    averageMs: z.number().int().nonnegative().nullable()
  }),
  score: z.number().int().nonnegative(),
  maxScore: z.number().int().nonnegative(),
  grade: z.string().min(1).max(8),
  findings: z.array(DNS_FINDING_SCHEMA).max(16),
  summary: z.string().min(1).max(500)
});

const EMAIL_SECURITY_FINDING_SCHEMA = z.object({
  id: z.string().min(1).max(120),
  severity: z.enum(["low", "medium", "high", "critical"]),
  message: z.string().min(1).max(400),
  evidence: z.string().nullable()
});

const EMAIL_SECURITY_SPF_SCHEMA = z.object({
  domain: z.string().min(1).max(255),
  record: z.string().nullable(),
  records: z.array(z.string().min(1).max(500)).max(12),
  policy: z.enum(["missing", "hard-fail", "soft-fail", "neutral", "allow-all", "missing-all"]),
  dnsLookupCount: z.number().int().nonnegative().max(50),
  tooManyLookups: z.boolean(),
  lookupLimit: z.number().int().positive().max(20),
  notes: z.array(z.string().min(1).max(320)).max(20)
});

const EMAIL_SECURITY_DMARC_SCHEMA = z.object({
  domain: z.string().min(1).max(255),
  record: z.string().nullable(),
  records: z.array(z.string().min(1).max(500)).max(12),
  policy: z.enum(["missing", "none", "quarantine", "reject", "invalid"]),
  rua: z.array(z.string().min(1).max(500)).max(20),
  ruf: z.array(z.string().min(1).max(500)).max(20),
  pct: z.number().int().min(0).max(100).nullable(),
  hasReporting: z.boolean(),
  notes: z.array(z.string().min(1).max(320)).max(20)
});

const EMAIL_SECURITY_DKIM_SELECTOR_SCHEMA = z.object({
  domain: z.string().min(1).max(255),
  selector: z.string().min(1).max(120),
  host: z.string().min(1).max(380),
  record: z.string().nullable(),
  records: z.array(z.string().min(1).max(500)).max(12),
  present: z.boolean(),
  valid: z.boolean(),
  notes: z.array(z.string().min(1).max(320)).max(20)
});

const EMAIL_SECURITY_DKIM_SCHEMA = z.object({
  testedSelectors: z.array(z.string().min(1).max(120)).max(20),
  selectors: z.array(EMAIL_SECURITY_DKIM_SELECTOR_SCHEMA).max(20),
  presentSelectors: z.array(z.string().min(1).max(120)).max(20),
  present: z.boolean()
});

const EMAIL_SECURITY_ANALYSIS_SCHEMA = z.object({
  domain: z.string().min(1).max(255),
  spf: EMAIL_SECURITY_SPF_SCHEMA,
  dmarc: EMAIL_SECURITY_DMARC_SCHEMA,
  dkim: EMAIL_SECURITY_DKIM_SCHEMA,
  score: z.number().int().nonnegative(),
  maxScore: z.number().int().nonnegative(),
  findings: z.array(EMAIL_SECURITY_FINDING_SCHEMA).max(60),
  recommendations: z.array(z.string().min(1).max(500)).max(40)
});

const MIXED_CONTENT_FINDING_SCHEMA = z.object({
  id: z.string().min(1).max(80),
  category: z.enum(["active", "passive"]),
  severity: z.enum(["critical", "warning"]),
  element: z.enum(["script", "link", "img", "iframe", "video", "audio", "source", "form", "a"]),
  attribute: z.enum(["src", "href", "action"]),
  url: z.string().url(),
  message: z.string().min(1).max(360),
  recommendation: z.string().min(1).max(500)
});

const MIXED_CONTENT_ANALYSIS_SCHEMA = z.object({
  available: z.boolean(),
  scannedUrl: z.string().url().nullable(),
  finalUrl: z.string().url().nullable(),
  isHttpsPage: z.boolean(),
  totalMixedContentCount: z.number().int().nonnegative(),
  activeCount: z.number().int().nonnegative(),
  passiveCount: z.number().int().nonnegative(),
  score: z.number().int().nonnegative(),
  maxScore: z.number().int().nonnegative(),
  grade: z.string().min(1).max(8),
  findings: z.array(MIXED_CONTENT_FINDING_SCHEMA).max(120),
  recommendations: z.array(z.string().min(1).max(500)).max(20),
  summary: z.string().min(1).max(500)
});

const SRI_RESOURCE_SCHEMA = z.object({
  id: z.string().min(1).max(80),
  resourceType: z.enum(["script", "stylesheet"]),
  url: z.string().url(),
  host: z.string().min(1).max(255),
  isCdn: z.boolean(),
  hasIntegrity: z.boolean(),
  integrity: z.string().nullable(),
  hasCrossorigin: z.boolean(),
  crossorigin: z.string().nullable()
});

const SRI_FINDING_SCHEMA = z.object({
  id: z.string().min(1).max(80),
  severity: z.enum(["low", "medium", "high", "critical"]),
  message: z.string().min(1).max(320),
  recommendation: z.string().min(1).max(400),
  resourceUrl: z.string().url(),
  resourceType: z.enum(["script", "stylesheet"]),
  isCdn: z.boolean()
});

const SRI_ANALYSIS_SCHEMA = z.object({
  available: z.boolean(),
  scannedUrl: z.string().url().nullable(),
  finalUrl: z.string().url().nullable(),
  externalResourceCount: z.number().int().nonnegative(),
  protectedResourceCount: z.number().int().nonnegative(),
  missingIntegrityCount: z.number().int().nonnegative(),
  missingCrossoriginCount: z.number().int().nonnegative(),
  coveragePercent: z.number().int().min(0).max(100),
  crossoriginCoveragePercent: z.number().int().min(0).max(100),
  score: z.number().int().nonnegative(),
  maxScore: z.number().int().nonnegative(),
  grade: z.string().min(1).max(8),
  findings: z.array(SRI_FINDING_SCHEMA).max(80),
  resources: z.array(SRI_RESOURCE_SCHEMA).max(120),
  summary: z.string().min(1).max(500)
});

const SECURITY_TXT_FIELDS_SCHEMA = z.object({
  contact: z.array(z.string().min(1).max(500)).max(12),
  expires: z.string().min(1).max(120).nullable(),
  encryption: z.array(z.string().min(1).max(500)).max(12),
  acknowledgments: z.array(z.string().min(1).max(500)).max(12),
  preferredLanguages: z.array(z.string().min(1).max(64)).max(12),
  canonical: z.array(z.string().min(1).max(500)).max(12),
  policy: z.array(z.string().min(1).max(500)).max(12),
  hiring: z.array(z.string().min(1).max(500)).max(12)
});

const SECURITY_TXT_VALIDATION_SCHEMA = z.object({
  present: z.boolean(),
  usesHttps: z.boolean(),
  hasContact: z.boolean(),
  hasExpires: z.boolean(),
  expiresValidFormat: z.boolean(),
  expiresExpired: z.boolean(),
  expiresExpiringSoon: z.boolean(),
  isValid: z.boolean()
});

const SECURITY_TXT_ANALYSIS_SCHEMA = z.object({
  available: z.boolean(),
  checkedUrl: z.string().url(),
  fetchedUrl: z.string().url().nullable(),
  fetchedFrom: z.enum(["/.well-known/security.txt", "/security.txt"]).nullable(),
  fallbackUsed: z.boolean(),
  statusCode: z.number().int().min(100).max(599).nullable(),
  fields: SECURITY_TXT_FIELDS_SCHEMA,
  foundFields: z
    .array(
      z.enum([
        "contact",
        "expires",
        "encryption",
        "acknowledgments",
        "preferredLanguages",
        "canonical",
        "policy",
        "hiring"
      ])
    )
    .max(8),
  validation: SECURITY_TXT_VALIDATION_SCHEMA,
  warnings: z.array(z.string().min(1).max(320)).max(20),
  recommendations: z.array(z.string().min(1).max(400)).max(20),
  score: z.number().int().nonnegative(),
  maxScore: z.number().int().nonnegative(),
  grade: z.string().min(1).max(8),
  summary: z.string().min(1).max(500)
});

const REPORT_SCHEMA = z.object({
  checkedUrl: z.string().url(),
  finalUrl: z.string().url(),
  statusCode: z.number().int(),
  score: z.number().int().nonnegative(),
  maxScore: z.number().int().nonnegative().optional(),
  grade: z.string().min(1).max(8),
  results: z.array(HEADER_RESULT_SCHEMA).min(1).max(40),
  cookieAnalysis: COOKIE_ANALYSIS_SCHEMA.optional(),
  corsAnalysis: CORS_ANALYSIS_SCHEMA.optional(),
  tlsAnalysis: TLS_ANALYSIS_SCHEMA.optional(),
  dnsAnalysis: DNS_ANALYSIS_SCHEMA.optional(),
  emailSecurityAnalysis: EMAIL_SECURITY_ANALYSIS_SCHEMA.optional(),
  mixedContentAnalysis: MIXED_CONTENT_ANALYSIS_SCHEMA.optional(),
  sriAnalysis: SRI_ANALYSIS_SCHEMA.optional(),
  securityTxtAnalysis: SECURITY_TXT_ANALYSIS_SCHEMA.optional(),
  checkedAt: z.string().datetime(),
  responseTimeMs: z.number().int().nonnegative().optional(),
  scanDurationMs: z.number().int().nonnegative().optional(),
  framework: FRAMEWORK_SCHEMA.optional().default({
    server: null,
    poweredBy: null,
    detected: null
  })
});

const SHARE_PAYLOAD_SCHEMA = z.discriminatedUnion("mode", [
  z.object({
    version: z.literal(1),
    mode: z.literal("single"),
    report: REPORT_SCHEMA
  }),
  z.object({
    version: z.literal(1),
    mode: z.literal("compare"),
    comparison: z.object({
      siteA: REPORT_SCHEMA,
      siteB: REPORT_SCHEMA
    })
  })
]);

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);

  const rateLimitResult = enforceApiRateLimit({
    request,
    route: "reports-share",
    identity: {
      isAuthenticated: Boolean(userKey),
      userKey
    },
    unauthenticatedLimit: 20,
    authenticatedLimit: 80
  });

  if (!rateLimitResult.ok) {
    return rateLimitResult.response;
  }

  const respond = (body: unknown, init?: ResponseInit) =>
    withApiRateLimitHeaders(NextResponse.json(body, init), rateLimitResult.state);

  const rawBody = (await request.json().catch(() => null)) as unknown;
  const parsed = SHARE_PAYLOAD_SCHEMA.safeParse(rawBody);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return respond({ error: issue?.message ?? "Invalid share payload." }, { status: 422 });
  }

  const sharedRecord = await createSharedReport(parsed.data as SharedReportPayload);
  return respond({
    id: sharedRecord.id,
    path: buildSharedReportPath(sharedRecord.id),
    createdAt: sharedRecord.createdAt,
    expiresAt: sharedRecord.expiresAt
  });
}
