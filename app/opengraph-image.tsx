import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Security Header Checker";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

export default function OpenGraphImage() {
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
            fontSize: 28,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            padding: "10px 20px"
          }}
        >
          Security Toolkit
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 86, fontWeight: 700, lineHeight: 1.08 }}>
            Security Header Checker
          </div>
          <div style={{ fontSize: 34, color: "#cbd5e1", maxWidth: 960 }}>
            Scan, score, and compare website headers in seconds.
          </div>
        </div>
      </div>
    ),
    size
  );
}
