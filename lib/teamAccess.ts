type SessionUser = {
  email?: string | null;
  name?: string | null;
} | null | undefined;

function isFeatureFlagDisabled(value: string | undefined): boolean {
  if (!value) return false;
  return ["0", "false", "off", "disabled"].includes(value.trim().toLowerCase());
}

export function hasTeamAccess(user: SessionUser): boolean {
  if (!user) return false;
  const envFlag =
    process.env.ENABLE_TEAM_FEATURES ??
    process.env.NEXT_PUBLIC_ENABLE_TEAM_FEATURES ??
    process.env.NEXT_PUBLIC_PRO_TEAM_FEATURES;
  if (isFeatureFlagDisabled(envFlag)) {
    return false;
  }
  return true;
}
