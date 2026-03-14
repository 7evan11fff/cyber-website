import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserKeyFromSessionUser } from "@/lib/userDataStore";

type SessionUser = {
  email?: string | null;
  name?: string | null;
} | null;

export type TeamRequestIdentity = {
  userKey: string | null;
  userEmail: string | null;
  sessionUser: SessionUser;
};

export async function resolveTeamRequestIdentity(request: Request): Promise<TeamRequestIdentity> {
  const bypassEnabled = process.env.E2E_TEAM_AUTH_BYPASS === "1";
  if (bypassEnabled) {
    const userKey = request.headers.get("x-e2e-team-user")?.trim().toLowerCase() ?? "";
    const userEmail = (request.headers.get("x-e2e-team-email")?.trim().toLowerCase() ?? userKey).trim();
    if (userKey && userEmail) {
      return {
        userKey,
        userEmail,
        sessionUser: {
          email: userEmail,
          name: request.headers.get("x-e2e-team-name")?.trim() || "E2E Team User"
        }
      };
    }
  }

  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  const userEmail = session?.user?.email?.trim().toLowerCase() ?? null;

  return {
    userKey,
    userEmail,
    sessionUser: session?.user ?? null
  };
}
