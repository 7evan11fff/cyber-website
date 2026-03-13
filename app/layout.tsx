import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Security Header Checker",
    template: "%s | Security Header Checker"
  },
  description:
    "Check website security headers, review recent scan history, and compare two sites side by side.",
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

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
