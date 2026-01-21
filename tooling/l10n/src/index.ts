const LOCALE_PATTERN = /^[a-z]{2}(?:-[a-z0-9]+)*$/;

export const LAYER_ORDER = ['base', 'locale', 'geo', 'industry', 'experiment', 'account', 'behavior', 'user'] as const;
export const LAYER_SELECTION = {
  locale: 'single',
  geo: 'single',
  industry: 'single',
  experiment: 'multi',
  account: 'single',
  behavior: 'multi',
  user: 'locale+global',
} as const;
export const LAYER_MULTI_KEY_ORDER = {
  experiment: 'expId-asc',
  behavior: 'lex',
} as const;
export const USER_FALLBACK_ORDER = ['locale', 'global'] as const;
export const GEO_TARGETS_SEMANTICS = 'locale-selection-only' as const;

export function normalizeLocaleToken(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/_/g, '-') : '';
  if (!value) return null;
  if (!LOCALE_PATTERN.test(value)) return null;
  return value;
}

export function localeCandidates(raw: unknown, supported?: Iterable<string>): string[] {
  const normalized = normalizeLocaleToken(raw);
  if (!normalized) return [];
  const base = normalized.split('-')[0] || '';
  if (!base) return [];

  const candidates = normalized === base ? [base] : [normalized, base];
  if (!supported) return candidates;

  const allowed = new Set(
    Array.from(supported)
      .map((value) => normalizeLocaleToken(value))
      .filter((value): value is string => Boolean(value)),
  );

  return candidates.filter((value) => allowed.has(value));
}

export function stableStringify(value: unknown): string {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',');
  return `{${body}}`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function computeBaseFingerprint(config: Record<string, unknown>): Promise<string> {
  return sha256Hex(stableStringify(config));
}
