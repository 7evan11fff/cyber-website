import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate"
};

const CONTACT_REQUEST_SCHEMA = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120, "Name is too long."),
  email: z.string().trim().email("Enter a valid email address.").max(320, "Email is too long."),
  subject: z.string().trim().min(3, "Subject must be at least 3 characters.").max(160, "Subject is too long."),
  message: z.string().trim().min(20, "Message must be at least 20 characters.").max(5000, "Message is too long.")
});

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  const parsedBody = CONTACT_REQUEST_SCHEMA.safeParse(body);
  if (!parsedBody.success) {
    const issue = parsedBody.error.issues[0];
    return NextResponse.json(
      { error: issue?.message ?? "Invalid contact form payload." },
      { status: 422, headers: NO_STORE_HEADERS }
    );
  }

  // Launch stub: this can later be replaced with email or ticket integration.
  console.info("[contact] message received", {
    name: parsedBody.data.name,
    email: parsedBody.data.email,
    subject: parsedBody.data.subject,
    length: parsedBody.data.message.length
  });

  return NextResponse.json(
    {
      ok: true,
      message: "Message received."
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
