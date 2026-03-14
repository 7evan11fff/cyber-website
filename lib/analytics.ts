"use client";

import { track as trackVercelEvent } from "@vercel/analytics";

type AnalyticsEventName =
  | "scan_complete"
  | "report_shared"
  | "bulk_scan"
  | "popular_domain_opened"
  | "scan_again_clicked"
  | "history_report_opened"
  | "quick_url_scan";
type AnalyticsProps = Record<string, string | number | boolean>;

export function trackEvent(name: AnalyticsEventName, props?: AnalyticsProps) {
  if (typeof window === "undefined") {
    return;
  }

  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
  const normalizedProps = props ? Object.fromEntries(Object.entries(props).map(([key, value]) => [key, String(value)])) : undefined;

  const plausible = (window as Window & {
    plausible?: (eventName: string, options?: { props?: Record<string, string> }) => void;
  }).plausible;
  if (plausibleDomain && typeof plausible === "function") {
    if (!normalizedProps || Object.keys(normalizedProps).length === 0) {
      plausible(name);
    } else {
      plausible(name, { props: normalizedProps });
    }
  }

  if (process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_DISABLED !== "true") {
    trackVercelEvent(name, props ?? {});
  }
}
