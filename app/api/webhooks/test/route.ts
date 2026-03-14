import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { enforceApiRateLimit, withApiRateLimitHeaders } from "@/lib/apiRateLimit";
import { authOptions } from "@/lib/auth";
import { getUserDataForUser, getUserKeyFromSessionUser } from "@/lib/userDataStore";
import { normalizeWebhookUrl, sendGradeChangeWebhook } from "@/lib/webhookDelivery";

export const runtime = "nodejs";

const TEST_WEBHOOK_SCHEMA = z
  .object({
    id: z.string().trim().min(1).max(200).optional(),
    url: z.string().trim().min(1).max(2048).optional()
  })
  .strict()
  .refine((value) => Boolean(value.id || value.url), {
    message: "Provide either a webhook id or a webhook URL."
  });

function createResponder(request: Request, route: string, userKey: string | null) {
  const rateLimitResult = enforceApiRateLimit({
    request,
    route,
    identity: {
      isAuthenticated: Boolean(userKey),
      userKey
    }
  });
  if (!rateLimitResult.ok) {
    return { blocked: rateLimitResult.response, respond: null };
  }
  return {
    blocked: null,
    respond: (body: unknown, init?: ResponseInit) =>
      withApiRateLimitHeaders(NextResponse.json(body, init), rateLimitResult.state)
  };
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  const { blocked, respond } = createResponder(request, "webhooks:test", userKey);
  if (blocked) return blocked;
  if (!userKey) {
    return respond!({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = TEST_WEBHOOK_SCHEMA.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return respond!({ error: issue?.message ?? "Invalid test webhook payload." }, { status: 400 });
  }

  const userData = await getUserDataForUser(userKey);
  let targetUrl: string | null = null;

  if (parsed.data.id) {
    const savedWebhook = userData.webhooks.find((webhook) => webhook.id === parsed.data.id);
    if (!savedWebhook) {
      return respond!({ error: "Webhook not found." }, { status: 404 });
    }
    targetUrl = savedWebhook.url;
  } else if (parsed.data.url) {
    try {
      targetUrl = normalizeWebhookUrl(parsed.data.url);
    } catch (error) {
      return respond!(
        {
          error: error instanceof Error ? error.message : "Webhook URL must use http or https."
        },
        { status: 400 }
      );
    }
  }

  if (!targetUrl) {
    return respond!({ error: "Webhook URL is required." }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  try {
    const result = await sendGradeChangeWebhook(targetUrl, {
      domain: "example.com",
      oldGrade: "B",
      newGrade: "A",
      timestamp: nowIso,
      checkedUrl: "https://example.com/",
      test: true
    });
    return respond!({
      ok: true,
      sent: true,
      kind: result.kind,
      testedAt: nowIso
    });
  } catch (error) {
    return respond!(
      {
        ok: false,
        sent: false,
        error: error instanceof Error ? error.message : "Webhook test delivery failed."
      },
      { status: 502 }
    );
  }
}
