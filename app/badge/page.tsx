import type { Metadata } from "next";
import { BadgePageClient } from "@/app/components/BadgePageClient";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Security Grade Badges",
  description:
    "Generate embeddable SVG and PNG security header grade badges for your website, then copy Markdown or HTML snippets.",
  path: "/badge"
});

export default function BadgePage() {
  return <BadgePageClient />;
}
