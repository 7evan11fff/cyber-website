"use client";

import { event } from "next-plausible";

type AnalyticsEventName = "scan_complete" | "report_shared" | "bulk_scan";
type AnalyticsProps = Record<string, string | number | boolean>;

export function trackEvent(name: AnalyticsEventName, props?: AnalyticsProps) {
  if (!process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) {
    return;
  }

  if (!props || Object.keys(props).length === 0) {
    event(name);
    return;
  }

  event(name, {
    props: Object.fromEntries(Object.entries(props).map(([key, value]) => [key, String(value)]))
  });
}
