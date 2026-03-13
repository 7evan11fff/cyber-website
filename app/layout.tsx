import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthSessionProvider } from "@/app/components/AuthSessionProvider";
import { ToastProvider } from "@/app/components/ToastProvider";
import { SITE_DESCRIPTION, SITE_NAME, buildOgImageUrl, resolveSiteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
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
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    type: "website",
    images: [
      {
        url: buildOgImageUrl({
          title: SITE_NAME,
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
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [
      buildOgImageUrl({
        title: SITE_NAME,
        description: SITE_DESCRIPTION
      })
    ]
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
