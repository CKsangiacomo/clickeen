export type PersonProfileSummary = {
  givenName?: string | null;
  familyName?: string | null;
  primaryEmail?: string | null;
};

export function resolvePersonLabel(
  profile: PersonProfileSummary | null | undefined,
): string | null {
  const combined = [profile?.givenName, profile?.familyName]
    .filter((value): value is string => value !== null && value !== undefined)
    .join(' ');
  if (combined) return combined;
  return profile?.primaryEmail ?? null;
}
