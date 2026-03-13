import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { ComparePageClient } from "@/app/components/ComparePageClient";

export const metadata: Metadata = buildPageMetadata({
  title: "Compare",
  description:
    "Compare security headers between two URLs side by side with clear, color-coded differences and grade summaries.",
  path: "/compare"
});

export default function ComparePage() {
  return <ComparePageClient />;
}
