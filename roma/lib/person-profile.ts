export type PersonProfileSummary = {
  givenName?: string | null;
  familyName?: string | null;
  primaryEmail?: string | null;
};

export function resolvePersonLabel(
  profile: PersonProfileSummary | null | undefined,
  fallback = 'User',
): string {
  const combined = [profile?.givenName, profile?.familyName]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ');
  if (combined) return combined;

  const primaryEmail = String(profile?.primaryEmail || '').trim();
  if (primaryEmail) return primaryEmail;

  const normalizedFallback = String(fallback || '').trim();
  return normalizedFallback || 'User';
}
