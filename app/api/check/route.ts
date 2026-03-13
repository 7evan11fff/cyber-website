import { NextResponse } from "next/server";
import { runSecurityScan } from "@/lib/securityReport";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const inputUrl = String(body?.url ?? "");
    const report = await runSecurityScan(inputUrl);
    return NextResponse.json(report);
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Request timed out while fetching headers."
        : error instanceof Error
          ? error.message
          : "Unable to check headers.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
