import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { enforceApiRateLimit, withApiRateLimitHeaders } from "@/lib/apiRateLimit";
import { authOptions } from "@/lib/auth";
import { getUserDataForUser, getUserKeyFromSessionUser, updateUserDataForUser } from "@/lib/userDataStore";

export const runtime = "nodejs";

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

function createApiKey() {
  return `shc_${randomBytes(24).toString("hex")}`;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  const { blocked, respond } = createResponder(request, "api-key:get", userKey);
  if (blocked) return blocked;
  if (!userKey) {
    return respond!({ error: "Unauthorized" }, { status: 401 });
  }

  const userData = await getUserDataForUser(userKey);
  return respond!({
    apiKey: userData.apiKey,
    hasApiKey: Boolean(userData.apiKey)
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  const { blocked, respond } = createResponder(request, "api-key:post", userKey);
  if (blocked) return blocked;
  if (!userKey) {
    return respond!({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = createApiKey();
  await updateUserDataForUser(userKey, { apiKey });
  return respond!({ apiKey, generated: true });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  const { blocked, respond } = createResponder(request, "api-key:delete", userKey);
  if (blocked) return blocked;
  if (!userKey) {
    return respond!({ error: "Unauthorized" }, { status: 401 });
  }

  await updateUserDataForUser(userKey, { apiKey: null });
  return respond!({ revoked: true, apiKey: null });
}
