import { NextResponse } from "next/server";

type NewsletterPayload = {
  email?: unknown;
};

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate"
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as NewsletterPayload | null;
  const email = typeof payload?.email === "string" ? payload.email.trim() : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400, headers: NO_STORE_HEADERS });
  }

  // Placeholder endpoint for future provider integration.
  return NextResponse.json(
    {
      ok: true,
      message: "Newsletter signup placeholder accepted."
    },
    { status: 202, headers: NO_STORE_HEADERS }
  );
}
