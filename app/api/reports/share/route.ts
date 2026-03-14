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

const REPORT_SCHEMA = z.object({
  checkedUrl: z.string().url(),
  finalUrl: z.string().url(),
  statusCode: z.number().int(),
  score: z.number().int().nonnegative(),
  grade: z.string().min(1).max(8),
  results: z.array(HEADER_RESULT_SCHEMA).min(1).max(40),
  checkedAt: z.string().datetime(),
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
