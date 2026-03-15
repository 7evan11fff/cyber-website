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
