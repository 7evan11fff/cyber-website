import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { enforceApiRateLimit, withApiRateLimitHeaders } from "@/lib/apiRateLimit";
import { authOptions } from "@/lib/auth";
import { MAX_WEBHOOK_ITEMS } from "@/lib/userData";
import { getUserDataForUser, getUserKeyFromSessionUser, updateUserDataForUser } from "@/lib/userDataStore";
import { normalizeWebhookUrl } from "@/lib/webhookDelivery";

export const runtime = "nodejs";

const CREATE_WEBHOOK_SCHEMA = z.object({
  url: z.string().trim().min(1, "Webhook URL is required.").max(2048, "Webhook URL is too long.")
});

async function getAuthorizedUserKey() {
  const session = await getServerSession(authOptions);
  return getUserKeyFromSessionUser(session?.user);
}

function buildResponder(request: Request, route: string, userKey: string | null) {
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

export async function GET(request: Request) {
  const userKey = await getAuthorizedUserKey();
  const { blocked, respond } = buildResponder(request, "webhooks:get", userKey);
  if (blocked) return blocked;
  if (!userKey) {
    return respond!({ error: "Unauthorized" }, { status: 401 });
  }

  const userData = await getUserDataForUser(userKey);
  return respond!({ webhooks: userData.webhooks });
}

export async function POST(request: Request) {
  const userKey = await getAuthorizedUserKey();
  const { blocked, respond } = buildResponder(request, "webhooks:post", userKey);
  if (blocked) return blocked;
  if (!userKey) {
    return respond!({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = CREATE_WEBHOOK_SCHEMA.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return respond!({ error: issue?.message ?? "Invalid webhook payload." }, { status: 400 });
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeWebhookUrl(parsed.data.url);
  } catch (error) {
    return respond!(
      {
        error: error instanceof Error ? error.message : "Invalid webhook URL."
      },
      { status: 400 }
    );
  }

  const userData = await getUserDataForUser(userKey);
  const duplicate = userData.webhooks.find((webhook) => webhook.url.toLowerCase() === normalizedUrl.toLowerCase());
  if (duplicate) {
    return respond!({
      webhook: duplicate,
      webhooks: userData.webhooks,
      created: false
    });
  }

  if (userData.webhooks.length >= MAX_WEBHOOK_ITEMS) {
    return respond!(
      {
        error: `Webhook limit reached. Remove one before adding another (max ${MAX_WEBHOOK_ITEMS}).`
      },
      { status: 400 }
    );
  }

  const nextWebhook = {
    id: randomUUID(),
    url: normalizedUrl,
    createdAt: new Date().toISOString()
  };
  const saved = await updateUserDataForUser(userKey, {
    webhooks: [nextWebhook, ...userData.webhooks]
  });

  return respond!({ webhook: nextWebhook, webhooks: saved.webhooks, created: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const userKey = await getAuthorizedUserKey();
  const { blocked, respond } = buildResponder(request, "webhooks:delete", userKey);
  if (blocked) return blocked;
  if (!userKey) {
    return respond!({ error: "Unauthorized" }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const idFromQuery = requestUrl.searchParams.get("id")?.trim();
  const body = idFromQuery
    ? null
    : ((await request.json().catch(() => null)) as { id?: unknown } | null);
  const idFromBody = body && typeof body.id === "string" ? body.id.trim() : "";
  const webhookId = idFromQuery || idFromBody;

  if (!webhookId) {
    return respond!({ error: "Webhook id is required." }, { status: 400 });
  }

  const userData = await getUserDataForUser(userKey);
  const existing = userData.webhooks.find((webhook) => webhook.id === webhookId);
  if (!existing) {
    return respond!({ error: "Webhook not found." }, { status: 404 });
  }

  const saved = await updateUserDataForUser(userKey, {
    webhooks: userData.webhooks.filter((webhook) => webhook.id !== webhookId)
  });
  return respond!({ deleted: true, webhooks: saved.webhooks });
}
