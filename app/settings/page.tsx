import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/app/components/SettingsForm";
import { SiteNav } from "@/app/components/SiteNav";
import { authOptions } from "@/lib/auth";
import { getUserDataForUser, getUserKeyFromSessionUser } from "@/lib/userDataStore";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);

  if (!session?.user || !userKey) {
    redirect("/auth/signin?callbackUrl=/settings");
  }

  const userData = await getUserDataForUser(userKey);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />
      <section className="mb-6 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100">Account and privacy controls</h1>
        <p className="mt-2 text-sm text-slate-300">
          Review your account details, notification preferences, and delete stored data when needed.
        </p>
      </section>

      <SettingsForm
        accountName={session.user.name ?? null}
        accountEmail={session.user.email ?? null}
        accountImage={session.user.image ?? null}
        initialAlertEmail={userData.alertEmail}
        initialNotificationOnGradeChange={userData.notificationOnGradeChange}
        lastUpdatedAt={userData.updatedAt}
      />
    </main>
  );
}
