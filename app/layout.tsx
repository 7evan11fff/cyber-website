import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AnalyticsProvider } from "@/app/components/AnalyticsProvider";
import { AuthSessionProvider } from "@/app/components/AuthSessionProvider";
import { ErrorBoundary } from "@/app/components/ErrorBoundary";
import { ServiceWorkerRegistrar } from "@/app/components/ServiceWorkerRegistrar";
import { ThemeProvider } from "@/app/components/ThemeProvider";
import { ToastProvider } from "@/app/components/ToastProvider";
import { SITE_DESCRIPTION, SITE_NAME, buildOgImageUrl, resolveSiteUrl } from "@/lib/seo";

const HOME_PAGE_TITLE = "Security Header Checker - Scan HTTP Security Headers";
const TWITTER_HANDLE = process.env.NEXT_PUBLIC_TWITTER_HANDLE?.trim() || undefined;

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
  applicationName: SITE_NAME,
  title: {
    default: HOME_PAGE_TITLE,
    template: `%s | ${SITE_NAME}`
  },
  description: SITE_DESCRIPTION,
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
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
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
    title: HOME_PAGE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    type: "website",
    images: [
      {
        url: buildOgImageUrl({
          title: HOME_PAGE_TITLE,
          description: SITE_DESCRIPTION
        }),
        width: 1200,
        height: 630,
        alt: SITE_NAME
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_PAGE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      buildOgImageUrl({
        title: HOME_PAGE_TITLE,
        description: SITE_DESCRIPTION
      })
    ],
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    shortcut: ["/icons/icon-192.png"],
    other: [{ rel: "icon", url: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png" }]
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#020617" />
        <link rel="preconnect" href="https://plausible.io" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://plausible.io" />
      </head>
      <body>
        <ThemeProvider>
          <AnalyticsProvider>
            <AuthSessionProvider>
              <ToastProvider>
                <ErrorBoundary>
                  <ServiceWorkerRegistrar />
                  {children}
                </ErrorBoundary>
              </ToastProvider>
            </AuthSessionProvider>
          </AnalyticsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
