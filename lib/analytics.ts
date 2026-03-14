"use client";

type AnalyticsEventName = "scan_complete" | "report_shared" | "bulk_scan";
type AnalyticsProps = Record<string, string | number | boolean>;

export function trackEvent(name: AnalyticsEventName, props?: AnalyticsProps) {
  if (typeof window === "undefined") {
    return;
  }

  if (!process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) {
    return;
  }

  const plausible = (window as Window & {
    plausible?: (eventName: string, options?: { props?: Record<string, string> }) => void;
  }).plausible;
  if (typeof plausible !== "function") {
    return;
  }

  if (!props || Object.keys(props).length === 0) {
    plausible(name);
    return;
  }

  plausible(name, {
    props: Object.fromEntries(Object.entries(props).map(([key, value]) => [key, String(value)]))
  });
}
