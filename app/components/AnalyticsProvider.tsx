"use client";

import type { ReactNode } from "react";
import PlausibleProvider from "next-plausible";

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
  if (!domain) {
    return <>{children}</>;
  }

  return (
    <PlausibleProvider domain={domain} enabled>
      {children}
    </PlausibleProvider>
  );
}
