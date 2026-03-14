import { ImageResponse } from "next/og";
import { getSharedReportById } from "@/lib/sharedReportsStore";

export const runtime = "nodejs";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

function extractHost(value: string): string {
  try {
    return new URL(value).hostname || value;
  } catch {
    return value;
  }
}

function buildOgContent(report: Awaited<ReturnType<typeof getSharedReportById>>) {
  if (!report) {
    return {
      domainLabel: "Shared report",
      gradeLabel: "Unavailable",
      detail: "This shared report no longer exists."
    };
  }

  if (report.payload.mode === "single") {
    const domain = extractHost(report.payload.report.finalUrl || report.payload.report.checkedUrl);
    return {
      domainLabel: domain,
      gradeLabel: report.payload.report.grade,
      detail: `Security header grade for ${domain}`
    };
  }

  const siteA = report.payload.comparison.siteA;
  const siteB = report.payload.comparison.siteB;
  const siteALabel = extractHost(siteA.finalUrl || siteA.checkedUrl);
  const siteBLabel = extractHost(siteB.finalUrl || siteB.checkedUrl);
  return {
    domainLabel: `${siteALabel} vs ${siteBLabel}`,
    gradeLabel: `${siteA.grade} vs ${siteB.grade}`,
    detail: "Security headers comparison report"
  };
}

export default async function ReportOpenGraphImage({
  params
}: {
  params: { id: string };
}) {
  const shared = await getSharedReportById(params.id);
  const content = buildOgContent(shared);

  return new ImageResponse(
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
            fontSize: 24,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            padding: "12px 20px"
          }}
        >
          Shared Security Report
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 78, fontWeight: 700, lineHeight: 1.05 }}>{content.gradeLabel}</div>
          <div style={{ fontSize: 42, fontWeight: 600, maxWidth: 1020 }}>{content.domainLabel}</div>
          <div style={{ fontSize: 28, color: "#cbd5e1", maxWidth: 980 }}>{content.detail}</div>
        </div>
      </div>
    ),
    size
  );
}
