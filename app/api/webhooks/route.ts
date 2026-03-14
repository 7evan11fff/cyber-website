import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { MAX_WEBHOOK_ITEMS } from "@/lib/userData";
import { getUserDataForUser, getUserKeyFromSessionUser, updateUserDataForUser } from "@/lib/userDataStore";

export const runtime = "nodejs";

const CREATE_WEBHOOK_SCHEMA = z.object({
  url: z.string().trim().min(1, "Webhook URL is required.").max(2048, "Webhook URL is too long.")
});

function normalizeWebhookUrl(input: string) {
  const parsed = new URL(input.trim());
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Webhook URL must use http or https.");
  }
  parsed.hash = "";
  return parsed.toString();
}

async function getAuthorizedUserKey() {
  const session = await getServerSession(authOptions);
  return getUserKeyFromSessionUser(session?.user);
}

export async function GET() {
  const userKey = await getAuthorizedUserKey();
  if (!userKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userData = await getUserDataForUser(userKey);
  return NextResponse.json({ webhooks: userData.webhooks });
}

export async function POST(request: Request) {
  const userKey = await getAuthorizedUserKey();
  if (!userKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = CREATE_WEBHOOK_SCHEMA.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue?.message ?? "Invalid webhook payload." }, { status: 400 });
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeWebhookUrl(parsed.data.url);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid webhook URL."
      },
      { status: 400 }
    );
  }

  const userData = await getUserDataForUser(userKey);
  const duplicate = userData.webhooks.find((webhook) => webhook.url.toLowerCase() === normalizedUrl.toLowerCase());
  if (duplicate) {
    return NextResponse.json({
      webhook: duplicate,
      webhooks: userData.webhooks,
      created: false
    });
  }

  if (userData.webhooks.length >= MAX_WEBHOOK_ITEMS) {
    return NextResponse.json(
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

  return NextResponse.json({ webhook: nextWebhook, webhooks: saved.webhooks, created: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const userKey = await getAuthorizedUserKey();
  if (!userKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const idFromQuery = requestUrl.searchParams.get("id")?.trim();
  const body = idFromQuery
    ? null
    : ((await request.json().catch(() => null)) as { id?: unknown } | null);
  const idFromBody = body && typeof body.id === "string" ? body.id.trim() : "";
  const webhookId = idFromQuery || idFromBody;

  if (!webhookId) {
    return NextResponse.json({ error: "Webhook id is required." }, { status: 400 });
  }

  const userData = await getUserDataForUser(userKey);
  const existing = userData.webhooks.find((webhook) => webhook.id === webhookId);
  if (!existing) {
    return NextResponse.json({ error: "Webhook not found." }, { status: 404 });
  }

  const saved = await updateUserDataForUser(userKey, {
    webhooks: userData.webhooks.filter((webhook) => webhook.id !== webhookId)
  });
  return NextResponse.json({ deleted: true, webhooks: saved.webhooks });
}
