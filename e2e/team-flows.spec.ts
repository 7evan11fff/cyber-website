import { expect, test } from "@playwright/test";

function teamHeaders(user: string, email = user) {
  return {
    "x-e2e-team-user": user,
    "x-e2e-team-email": email,
    "Content-Type": "application/json"
  };
}

test("critical team API flow: create team, invite, accept invite", async ({ request }) => {
  const ownerEmail = `owner-${Date.now()}@example.com`;
  const inviteeEmail = `invitee-${Date.now()}@example.com`;
  const teamName = `E2E Team ${Date.now()}`;
  let teamSlug: string | null = null;

  const createResponse = await request.post("/api/teams", {
    headers: teamHeaders(ownerEmail),
    data: { name: teamName }
  });
  expect(createResponse.ok()).toBeTruthy();
  const createPayload = (await createResponse.json()) as {
    team?: { slug?: string };
  };
  expect(createPayload.team?.slug).toBeTruthy();
  teamSlug = createPayload.team?.slug ?? null;
  expect(teamSlug).not.toBeNull();

  const inviteResponse = await request.post(`/api/teams/${encodeURIComponent(teamSlug!)}/invites`, {
    headers: teamHeaders(ownerEmail),
    data: { email: inviteeEmail }
  });
  expect(inviteResponse.ok()).toBeTruthy();
  const invitePayload = (await inviteResponse.json()) as {
    invite?: { token?: string; email?: string };
  };
  expect(invitePayload.invite?.email).toBe(inviteeEmail);
  expect(invitePayload.invite?.token).toBeTruthy();

  const acceptResponse = await request.post(
    `/api/team-invites/${encodeURIComponent(invitePayload.invite?.token ?? "")}/accept`,
    {
      headers: teamHeaders(inviteeEmail)
    }
  );
  expect(acceptResponse.ok()).toBeTruthy();
  const acceptPayload = (await acceptResponse.json()) as {
    ok?: boolean;
    teamSlug?: string;
  };
  expect(acceptPayload.ok).toBe(true);
  expect(acceptPayload.teamSlug).toBe(teamSlug);

  const inviteeTeamsResponse = await request.get("/api/teams", {
    headers: teamHeaders(inviteeEmail)
  });
  expect(inviteeTeamsResponse.ok()).toBeTruthy();
  const inviteeTeamsPayload = (await inviteeTeamsResponse.json()) as {
    teams?: Array<{ slug?: string }>;
  };
  expect(inviteeTeamsPayload.teams?.some((team) => team.slug === teamSlug)).toBe(true);

  const cleanupResponse = await request.delete(`/api/teams/${encodeURIComponent(teamSlug!)}`, {
    headers: teamHeaders(ownerEmail),
    data: { action: "delete" }
  });
  expect(cleanupResponse.ok()).toBeTruthy();
});
