import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { withApiRateLimitHeaders, enforceApiRateLimit } from "@/lib/apiRateLimit";
import { SITE_NAME } from "@/lib/seo";

export const runtime = "edge";

const IMAGE_SIZE = {
  width: 1200,
  height: 630
};

function normalizeValue(value: string | null, fallback: string, maxLength: number): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}...`;
}

export function GET(request: NextRequest) {
  const rateLimitResult = enforceApiRateLimit({
    request,
    route: "og:get"
  });
  if (!rateLimitResult.ok) {
    return rateLimitResult.response;
  }

  const { searchParams } = new URL(request.url);
  const title = normalizeValue(searchParams.get("title"), SITE_NAME, 90);
  const description = normalizeValue(
    searchParams.get("description"),
    "Scan, score, and compare website security headers in seconds.",
    180
  );

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "radial-gradient(circle at top left, rgba(56, 189, 248, 0.35), transparent 45%), radial-gradient(circle at bottom right, rgba(14, 116, 144, 0.4), transparent 45%), #020617",
          color: "#f8fafc",
          padding: "64px",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: "999px",
            border: "1px solid rgba(56, 189, 248, 0.45)",
            background: "rgba(15, 23, 42, 0.7)",
            color: "#7dd3fc",
            fontSize: 22,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            padding: "12px 20px"
          }}
        >
          Security SEO Card
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 74, fontWeight: 700, lineHeight: 1.08 }}>{title}</div>
          <div style={{ fontSize: 32, color: "#cbd5e1", maxWidth: 980 }}>{description}</div>
        </div>
      </div>
    ),
    IMAGE_SIZE
  );
  image.headers.set("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  return withApiRateLimitHeaders(image, rateLimitResult.state);
}
