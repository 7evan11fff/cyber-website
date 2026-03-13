import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthSessionProvider } from "@/app/components/AuthSessionProvider";
import { ToastProvider } from "@/app/components/ToastProvider";

const FALLBACK_SITE_URL = "https://security-header-checker.vercel.app";

function resolveMetadataBase(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configuredUrl) {
    return new URL(FALLBACK_SITE_URL);
  }

  try {
    return new URL(configuredUrl);
  } catch {
    return new URL(FALLBACK_SITE_URL);
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  applicationName: "Security Header Checker",
  title: {
    default: "Security Header Checker",
    template: "%s | Security Header Checker"
  },
  description:
    "Check website security headers, review recent scan history, and compare two sites side by side.",
  keywords: [
    "security headers",
    "http headers",
    "website security scanner",
    "content-security-policy",
    "hsts",
    "x-frame-options"
  ],
  category: "technology",
  alternates: {
    canonical: "/"
  },
  authors: [{ name: "Security Header Checker" }],
  creator: "Security Header Checker",
  publisher: "Security Header Checker",
  robots: {
    index: true,
    follow: true
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false
  },
  openGraph: {
    title: "Security Header Checker",
    description:
      "Instantly scan security headers, keep local scan history, and compare two URLs in a premium split view.",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Security Header Checker"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Security Header Checker",
    description:
      "Scan security headers, save recent checks, and compare two sites in one view.",
    images: ["/opengraph-image"]
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico"
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" }
  ]
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthSessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
