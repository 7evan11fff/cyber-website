import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { AnalyticsProvider } from "@/app/components/AnalyticsProvider";
import { AuthSessionProvider } from "@/app/components/AuthSessionProvider";
import { ErrorBoundary } from "@/app/components/ErrorBoundary";
import { PwaInstallBanner } from "@/app/components/PwaInstallBanner";
import { ServiceWorkerRegistrar } from "@/app/components/ServiceWorkerRegistrar";
import { ThemeProvider } from "@/app/components/ThemeProvider";
import { ToastProvider } from "@/app/components/ToastProvider";
import { SITE_DESCRIPTION, SITE_NAME, buildOgImageUrl, resolveSiteUrl } from "@/lib/seo";

const HOME_PAGE_TITLE = "Security Header Checker - Scan HTTP Security Headers";
const TWITTER_HANDLE = process.env.NEXT_PUBLIC_TWITTER_HANDLE?.trim() || undefined;
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true
});

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
    "security scan history",
    "website security report",
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
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
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
    locale: "en_US",
    images: [
      {
        url: buildOgImageUrl({
          title: HOME_PAGE_TITLE,
          description: SITE_DESCRIPTION
        }),
        width: 1200,
        height: 630,
        alt: SITE_NAME
      },
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} Open Graph image fallback`
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
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
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
        <meta name="theme-color" content="#0f172a" />
        <link rel="preload" as="image" href="/icons/icon-192.png" fetchPriority="high" />
        <link rel="preconnect" href="https://plausible.io" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://plausible.io" />
      </head>
      <body className={inter.className}>
        <a
          href="#main-content"
          className="sr-only fixed left-3 top-3 z-[100] rounded-md border border-sky-400 bg-slate-950 px-4 py-2 text-sm font-semibold text-sky-100 shadow-lg shadow-slate-950 focus:not-sr-only focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <AnalyticsProvider>
            <AuthSessionProvider>
              <ToastProvider>
                <ErrorBoundary>
                  <ServiceWorkerRegistrar />
                  <PwaInstallBanner />
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
