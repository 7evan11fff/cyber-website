"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, Radar, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type HeaderStatus = "present" | "missing" | "misconfigured";

interface HeaderItem {
  key: string;
  name: string;
  category: "critical" | "important" | "additional";
  status: HeaderStatus;
  value: string | null;
  recommendation: string;
  documentationUrl: string;
  score: number;
  maxScore: number;
}

interface AnalysisResponse {
  targetUrl: string;
  finalUrl: string;
  statusCode: number;
  scannedAt: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "E" | "F";
  summary: {
    present: number;
    missing: number;
    misconfigured: number;
  };
  results: HeaderItem[];
}

const gradeStyle: Record<AnalysisResponse["grade"], string> = {
  A: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  B: "text-lime-300 border-lime-500/40 bg-lime-500/10",
  C: "text-yellow-300 border-yellow-500/40 bg-yellow-500/10",
  D: "text-orange-300 border-orange-500/40 bg-orange-500/10",
  E: "text-rose-300 border-rose-500/40 bg-rose-500/10",
  F: "text-red-300 border-red-500/40 bg-red-500/10"
};

function statusToVariant(status: HeaderStatus): "success" | "destructive" | "warning" {
  if (status === "present") {
    return "success";
  }
  if (status === "missing") {
    return "destructive";
  }
  return "warning";
}

function statusLabel(status: HeaderStatus): string {
  if (status === "present") {
    return "Present";
  }
  if (status === "missing") {
    return "Missing";
  }
  return "Misconfigured";
}

export function SecurityHeaderChecker() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<AnalysisResponse | null>(null);

  const sortedResults = useMemo(() => {
    if (!data) {
      return [];
    }

    const rank: Record<HeaderStatus, number> = {
      missing: 0,
      misconfigured: 1,
      present: 2
    };

    return [...data.results].sort((a, b) => rank[a.status] - rank[b.status]);
  }, [data]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ url })
      });

      const payload = (await response.json()) as AnalysisResponse | { error: string };
      if (!response.ok || "error" in payload) {
        setData(null);
        setError("error" in payload ? payload.error : "Scan failed.");
        return;
      }

      setData(payload);
    } catch {
      setData(null);
      setError("Unable to reach the scanner service. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-emerald-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl text-emerald-300">
            <Radar className="h-6 w-6" />
            Security Header Scanner
          </CardTitle>
          <CardDescription>
            Analyze a site&apos;s HTTP response headers and receive an instant security grade with targeted remediation guidance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3" onSubmit={onSubmit}>
            <Input
              type="text"
              placeholder="https://example.com"
              required
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className="sm:flex-1"
            />
            <Button type="submit" className="w-full sm:w-auto animate-pulseGlow">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                "Run Scan"
              )}
            </Button>
          </form>
          {error ? (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {data ? (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="border-emerald-500/25">
            <CardHeader>
              <CardTitle className="text-lg">Security Grade</CardTitle>
              <CardDescription>Overall HTTP header hardening posture</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={cn(
                  "flex h-28 items-center justify-center rounded-lg border text-5xl font-bold tracking-widest",
                  gradeStyle[data.grade]
                )}
              >
                {data.grade}
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Score: <span className="font-semibold text-foreground">{data.score}/100</span>
                </p>
                <p className="text-muted-foreground">
                  Status code: <span className="font-semibold text-foreground">{data.statusCode}</span>
                </p>
                <p className="text-muted-foreground break-all">
                  Final URL: <span className="font-semibold text-foreground">{data.finalUrl}</span>
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 p-2 text-emerald-200">
                  <p className="text-lg font-semibold">{data.summary.present}</p>
                  <p>Present</p>
                </div>
                <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-2 text-amber-200">
                  <p className="text-lg font-semibold">{data.summary.misconfigured}</p>
                  <p>Needs Fix</p>
                </div>
                <div className="rounded-md border border-rose-500/25 bg-rose-500/10 p-2 text-rose-200">
                  <p className="text-lg font-semibold">{data.summary.missing}</p>
                  <p>Missing</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/25">
            <CardHeader>
              <CardTitle className="text-lg">Detailed Header Analysis</CardTitle>
              <CardDescription>Review each header and apply recommendations to improve your score.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sortedResults.map((result) => (
                <article
                  key={result.key}
                  className="rounded-lg border border-border/70 bg-background/40 p-4 transition-all duration-300 hover:border-emerald-500/30"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <h3 className="font-medium text-foreground">{result.name}</h3>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{result.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusToVariant(result.status)}>{statusLabel(result.status)}</Badge>
                      <Badge variant="outline">
                        {result.score}/{result.maxScore}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="break-all">
                      <span className="font-medium text-foreground">Current value:</span>{" "}
                      {result.value ? <code className="text-emerald-200">{result.value}</code> : "Not set"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Recommendation:</span> {result.recommendation}
                    </p>
                    <a
                      href={result.documentationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-300 transition-colors hover:text-emerald-200"
                    >
                      Documentation <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </article>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-emerald-500/20">
          <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            <ShieldCheck className="h-5 w-5 text-emerald-300" />
            Run a scan to see your security posture, missing headers, and hardening tips.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
