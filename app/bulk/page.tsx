import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { BulkPageClient } from "@/app/components/BulkPageClient";

export const metadata: Metadata = buildPageMetadata({
  title: "Bulk Scan",
  description:
    "Bulk scan up to 10 URLs at once and compare grade, missing headers, and full report links in one table.",
  path: "/bulk"
});

export default function BulkPage() {
  return <BulkPageClient />;
}
