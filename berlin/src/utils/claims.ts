export function asBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  if (!token) return null;
  const trimmed = token.trim();
  return trimmed || null;
}

export function claimAsString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

export function claimAsNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function audienceMatches(claim: unknown, expected: string): boolean {
  if (typeof claim === 'string') return claim === expected;
  if (Array.isArray(claim)) return claim.some((entry) => typeof entry === 'string' && entry === expected);
  return false;
}
