import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { SiteNav } from "@/app/components/SiteNav";
import { TeamInviteAcceptClient } from "@/app/components/TeamInviteAcceptClient";
import { authOptions } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/seo";
import { hasTeamAccess } from "@/lib/teamAccess";

export const metadata: Metadata = buildPageMetadata({
  title: "Accept Team Invite",
  description: "Accept your Security Header Checker team invitation.",
  path: "/teams/invite",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } }
});

export default async function TeamInvitePage({ params }: { params: { token: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/auth/signin?callbackUrl=/teams/invite/${encodeURIComponent(params.token)}`);
  }
  if (!hasTeamAccess(session.user)) {
    redirect("/pricing");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />
      <TeamInviteAcceptClient token={params.token} />
    </main>
  );
}
