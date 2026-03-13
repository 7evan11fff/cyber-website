import type { Metadata } from "next";

export const SITE_NAME = "Security Header Checker";
export const SITE_DESCRIPTION =
  "Check website security headers, review recent scan history, and compare two sites side by side.";
export const FALLBACK_SITE_URL = "https://security-header-checker.vercel.app";

function normalizePath(path: string): string {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function resolveSiteUrl(): URL {
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

export function absoluteUrl(path: string): string {
  return new URL(normalizePath(path), resolveSiteUrl()).toString();
}

type OgImageOptions = {
  title: string;
  description: string;
};

export function buildOgImageUrl(options: OgImageOptions): string {
  const params = new URLSearchParams({
    title: options.title,
    description: options.description
  });
  return `${absoluteUrl("/api/og")}?${params.toString()}`;
}

function withSiteName(title: string): string {
  return title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
}

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
};

export function buildPageMetadata(options: PageMetadataOptions): Metadata {
  const pagePath = normalizePath(options.path);
  const ogImageUrl = buildOgImageUrl({
    title: withSiteName(options.title),
    description: options.description
  });
  const pageTitle = withSiteName(options.title);

  return {
    title: options.title,
    description: options.description,
    keywords: options.keywords,
    alternates: {
      canonical: pagePath
    },
    openGraph: {
      title: pageTitle,
      description: options.description,
      url: pagePath,
      siteName: SITE_NAME,
      type: "website",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: pageTitle
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: options.description,
      images: [ogImageUrl]
    }
  };
}
