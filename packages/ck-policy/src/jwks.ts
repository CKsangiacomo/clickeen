type JwksCacheEntry = {
  fetchedAt: number;
  expiresAt: number;
  keys: Record<string, CryptoKey>;
};

type JwksStore = {
  cacheByUrl: Record<string, JwksCacheEntry | undefined>;
};

const DEFAULT_JWKS_TTL_MS = 5 * 60_000;

function isJwksStore(value: unknown): value is JwksStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const cacheByUrl = record.cacheByUrl;
  return Boolean(cacheByUrl && typeof cacheByUrl === 'object' && !Array.isArray(cacheByUrl));
}

function resolveJwksStore(cacheKey: string): JwksStore {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[cacheKey];
  if (isJwksStore(existing)) return existing;
  const next: JwksStore = { cacheByUrl: {} };
  scope[cacheKey] = next;
  return next;
}

function jwkKid(value: JsonWebKey): string | null {
  const raw = (value as Record<string, unknown>).kid;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

async function importVerifyKey(jwk: JsonWebKey): Promise<CryptoKey | null> {
  if (jwk.kty !== 'RSA') return null;
  if (!jwkKid(jwk)) return null;
  if (typeof jwk.n !== 'string' || typeof jwk.e !== 'string') return null;
  try {
    return await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
  } catch {
    return null;
  }
}

async function fetchJwks(url: string, ttlMs: number): Promise<JwksCacheEntry> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    const bodySnippet = (await response.text().catch(() => '')).slice(0, 160);
    throw new Error(`JWKS lookup failed (${response.status}) url=${url}${bodySnippet ? ` body=${bodySnippet}` : ''}`);
  }

  const parsed = (await response.json().catch(() => null)) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JWKS response is malformed');
  }

  const keysRaw = (parsed as Record<string, unknown>).keys;
  if (!Array.isArray(keysRaw)) throw new Error('JWKS keys missing');

  const keys: Record<string, CryptoKey> = {};
  for (const item of keysRaw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const jwk = item as JsonWebKey;
    const kid = jwkKid(jwk) || '';
    if (!kid) continue;
    const imported = await importVerifyKey(jwk);
    if (!imported) continue;
    keys[kid] = imported;
  }

  const now = Date.now();
  return {
    fetchedAt: now,
    expiresAt: now + ttlMs,
    keys,
  };
}

export async function resolveCachedJwksVerifyKey(args: {
  cacheKey: string;
  jwksUrl: string;
  kid: string;
  ttlMs?: number;
}): Promise<CryptoKey | null> {
  const url = String(args.jwksUrl || '').trim();
  const kid = String(args.kid || '').trim();
  if (!url || !kid) return null;

  const ttlMs = args.ttlMs && Number.isFinite(args.ttlMs) && args.ttlMs > 0 ? Math.trunc(args.ttlMs) : DEFAULT_JWKS_TTL_MS;
  const store = resolveJwksStore(args.cacheKey);
  const now = Date.now();
  const cached = store.cacheByUrl[url];
  if (cached && cached.expiresAt > now && cached.keys[kid]) {
    return cached.keys[kid] || null;
  }

  const fresh = await fetchJwks(url, ttlMs);
  store.cacheByUrl[url] = fresh;
  return fresh.keys[kid] || null;
}
