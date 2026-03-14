import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Security Header Checker",
    short_name: "HeaderChecker",
    description: "Scan, compare, and share security header reports with an installable app experience.",
    id: "/",
    scope: "/",
    lang: "en-US",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#020617",
    theme_color: "#020617",
    categories: ["security", "developer", "utilities", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ],
    shortcuts: [
      {
        name: "New scan",
        short_name: "Scan",
        description: "Run a new security header scan",
        url: "/"
      },
      {
        name: "Quick fixes",
        short_name: "Fixes",
        description: "Open header remediation guidance",
        url: "/fixes"
      },
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "Review watchlist and history",
        url: "/dashboard"
      }
    ]
  };
}
