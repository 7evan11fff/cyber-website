import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Authenticate to access saved watchlists and synced scan history.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/auth/signin" }
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
