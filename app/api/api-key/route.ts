import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserDataForUser, getUserKeyFromSessionUser, updateUserDataForUser } from "@/lib/userDataStore";

export const runtime = "nodejs";

function createApiKey() {
  return `shc_${randomBytes(24).toString("hex")}`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!userKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userData = await getUserDataForUser(userKey);
  return NextResponse.json({
    apiKey: userData.apiKey,
    hasApiKey: Boolean(userData.apiKey)
  });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!userKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = createApiKey();
  await updateUserDataForUser(userKey, { apiKey });
  return NextResponse.json({ apiKey, generated: true });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!userKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await updateUserDataForUser(userKey, { apiKey: null });
  return NextResponse.json({ revoked: true, apiKey: null });
}
