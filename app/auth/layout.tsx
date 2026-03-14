import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Sign in",
  description: "Authenticate to access saved watchlists and synced scan history.",
  path: "/auth/signin",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } }
});

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
