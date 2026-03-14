"use client";

import type { ReactNode } from "react";
import PlausibleProvider from "next-plausible";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
  const vercelAnalyticsEnabled = process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_DISABLED !== "true";
  if (!domain) {
    return (
      <>
        {children}
        {vercelAnalyticsEnabled ? <VercelAnalytics /> : null}
      </>
    );
  }

  return (
    <PlausibleProvider domain={domain} enabled>
      {children}
      {vercelAnalyticsEnabled ? <VercelAnalytics /> : null}
    </PlausibleProvider>
  );
}
