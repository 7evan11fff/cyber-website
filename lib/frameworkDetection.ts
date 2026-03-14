export type DetectedFrameworkId =
  | "nextjs"
  | "express"
  | "nginx"
  | "apache"
  | "cloudflare-workers"
  | "nodejs";

export type FrameworkEvidence = {
  header: string;
  value: string;
};

export type DetectedFramework = {
  id: DetectedFrameworkId;
  label: string;
  reason: string;
  evidence: FrameworkEvidence[];
};

export type FrameworkInfo = {
  server: string | null;
  poweredBy: string | null;
  detected: DetectedFramework | null;
};

function normalizeHeader(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function detectFromHeaders(server: string | null, poweredBy: string | null, cfWorker: string | null): DetectedFramework | null {
  const serverLower = server?.toLowerCase() ?? "";
  const poweredByLower = poweredBy?.toLowerCase() ?? "";
  const cfWorkerLower = cfWorker?.toLowerCase() ?? "";

  if (poweredByLower.includes("next.js") || poweredByLower.includes("nextjs")) {
    return {
      id: "nextjs",
      label: "Next.js",
      reason: "Detected from X-Powered-By response header.",
      evidence: [{ header: "x-powered-by", value: poweredBy as string }]
    };
  }

  if (poweredByLower.includes("express")) {
    return {
      id: "express",
      label: "Express.js",
      reason: "Detected from X-Powered-By response header.",
      evidence: [{ header: "x-powered-by", value: poweredBy as string }]
    };
  }

  if (serverLower.includes("nginx")) {
    return {
      id: "nginx",
      label: "Nginx",
      reason: "Detected from Server response header.",
      evidence: [{ header: "server", value: server as string }]
    };
  }

  if (serverLower.includes("apache")) {
    return {
      id: "apache",
      label: "Apache",
      reason: "Detected from Server response header.",
      evidence: [{ header: "server", value: server as string }]
    };
  }

  if (serverLower.includes("cloudflare") || cfWorkerLower.includes(".") || cfWorkerLower.includes("worker")) {
    const evidence: FrameworkEvidence[] = [];
    if (server) {
      evidence.push({ header: "server", value: server });
    }
    if (cfWorker) {
      evidence.push({ header: "cf-worker", value: cfWorker });
    }
    return {
      id: "cloudflare-workers",
      label: "Cloudflare Workers",
      reason: "Cloudflare edge headers were detected.",
      evidence
    };
  }

  if (poweredByLower.includes("node")) {
    return {
      id: "nodejs",
      label: "Node.js",
      reason: "Detected from X-Powered-By response header.",
      evidence: [{ header: "x-powered-by", value: poweredBy as string }]
    };
  }

  return null;
}

export function detectFrameworkInfo(headers: Headers): FrameworkInfo {
  const server = normalizeHeader(headers.get("server"));
  const poweredBy = normalizeHeader(headers.get("x-powered-by"));
  const cfWorker = normalizeHeader(headers.get("cf-worker"));
  const detected = detectFromHeaders(server, poweredBy, cfWorker);

  return {
    server,
    poweredBy,
    detected
  };
}
