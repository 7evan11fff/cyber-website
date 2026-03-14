import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { enforceApiRateLimit, withApiRateLimitHeaders } from "@/lib/apiRateLimit";
import { SITE_NAME } from "@/lib/seo";

export const runtime = "edge";

const IMAGE_SIZE = {
  width: 1200,
  height: 630
};

const GRADE_COLORS: Record<string, { text: string; border: string; background: string }> = {
  A: { text: "#34d399", border: "rgba(52, 211, 153, 0.55)", background: "rgba(5, 46, 22, 0.55)" },
  B: { text: "#a3e635", border: "rgba(163, 230, 53, 0.55)", background: "rgba(54, 83, 20, 0.55)" },
  C: { text: "#fbbf24", border: "rgba(251, 191, 36, 0.6)", background: "rgba(120, 53, 15, 0.45)" },
  D: { text: "#fb923c", border: "rgba(251, 146, 60, 0.6)", background: "rgba(124, 45, 18, 0.45)" },
  F: { text: "#fb7185", border: "rgba(251, 113, 133, 0.6)", background: "rgba(127, 29, 29, 0.45)" }
};

function normalizeDomain(raw: string): string {
  const safe = decodeURIComponent(raw).trim().toLowerCase().replace(/[^a-z0-9.-]/g, "");
  if (!safe) return "secured-site.example";
  if (safe.length <= 70) return safe;
  return `${safe.slice(0, 67)}...`;
}

function normalizeGrade(raw: string | null): string {
  const grade = (raw ?? "A").trim().toUpperCase();
  return GRADE_COLORS[grade] ? grade : "A";
}

function normalizeScore(raw: string | null): string {
  if (!raw) return "20/22";
  const trimmed = raw.trim();
  if (!trimmed) return "20/22";
  if (trimmed.length <= 18) return trimmed;
  return `${trimmed.slice(0, 15)}...`;
}

export function GET(request: NextRequest, { params }: { params: { domain: string } }) {
  const rateLimitResult = enforceApiRateLimit({
    request,
    route: "og-domain:get"
  });
  if (!rateLimitResult.ok) {
    return rateLimitResult.response;
  }

  const domain = normalizeDomain(params.domain);
  const { searchParams } = new URL(request.url);
  const grade = normalizeGrade(searchParams.get("grade"));
  const score = normalizeScore(searchParams.get("score"));
  const palette = GRADE_COLORS[grade];

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
            "radial-gradient(circle at top left, rgba(56, 189, 248, 0.32), transparent 45%), radial-gradient(circle at bottom right, rgba(14, 116, 144, 0.36), transparent 46%), #020617",
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
            background: "rgba(15, 23, 42, 0.74)",
            color: "#7dd3fc",
            fontSize: 20,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            padding: "10px 18px"
          }}
        >
          Security Header Scan
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 30 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: "74%" }}>
            <div style={{ fontSize: 32, color: "#cbd5e1", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {SITE_NAME}
            </div>
            <div style={{ fontSize: 68, lineHeight: 1.06, fontWeight: 700 }}>{domain}</div>
            <div style={{ fontSize: 30, color: "#cbd5e1" }}>Score {score} on security headers</div>
          </div>
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: "9999px",
              border: `4px solid ${palette.border}`,
              background: palette.background,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: palette.text,
              boxShadow: "0 22px 40px rgba(2, 6, 23, 0.55)"
            }}
          >
            <div style={{ fontSize: 112, fontWeight: 700, lineHeight: 1 }}>{grade}</div>
          </div>
        </div>
      </div>
    ),
    IMAGE_SIZE
  );
  image.headers.set("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  return withApiRateLimitHeaders(image, rateLimitResult.state);
}
