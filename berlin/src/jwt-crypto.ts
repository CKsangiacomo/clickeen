import {
  ACCESS_TOKEN_SKEW_SECONDS,
  DEFAULT_AUDIENCE,
  DEFAULT_ISSUER,
  REFRESH_KEY_CACHE,
  REFRESH_RTI_GRACE_MS,
  REFRESH_TOKEN_PREFIX,
  SIGNING_CONTEXT_KEY,
  type AccessClaims,
  type Env,
  type JwtHeader,
  type RefreshPayload,
  type RefreshPayloadV2,
  type RefreshResult,
  type SigningContext,
  type SigningPublic,
} from './types';
import {
  audienceMatches,
  claimAsNumber,
  claimAsString,
  decodeJsonBase64Url,
  enc,
  encodeJsonBase64Url,
  fromBase64Url,
  normalizePem,
  pemToArrayBuffer,
  toArrayBuffer,
  toBase64Url,
} from './helpers';

async function importRsaPrivateKeyFromPem(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function importRsaPublicKeyFromPem(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true,
    ['verify'],
  );
}

async function buildKid(publicJwk: JsonWebKey): Promise<string> {
  const payload = JSON.stringify({
    kty: publicJwk.kty,
    n: publicJwk.n,
    e: publicJwk.e,
  });
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(payload));
  return `berlin-${toBase64Url(new Uint8Array(digest)).slice(0, 16)}`;
}

async function exportSigningPublic(publicKey: CryptoKey, preferredKid?: string | null): Promise<SigningPublic> {
  const publicJwk = (await crypto.subtle.exportKey('jwk', publicKey)) as JsonWebKey;
  if (!publicJwk.kty || !publicJwk.n || !publicJwk.e) {
    throw new Error('[berlin] Failed to export access public JWK');
  }
  const kid = preferredKid && preferredKid.trim() ? preferredKid.trim() : await buildKid(publicJwk);
  return {
    kid,
    publicKey,
    publicJwk: {
      ...publicJwk,
      kid,
      alg: 'RS256',
      use: 'sig',
    },
  };
}

export async function resolveSigningContext(env: Env): Promise<SigningContext> {
  const scope = globalThis as Record<string, unknown>;
  const cached = scope[SIGNING_CONTEXT_KEY];
  if (cached) return cached as SigningContext;
  // Berlin runs on Cloudflare Workers, so module/global state is isolate-local and
  // single-threaded for the lifetime of that isolate. We intentionally cache the
  // imported signing material here instead of building a second coordination layer.

  const privatePem = normalizePem(env.BERLIN_ACCESS_PRIVATE_KEY_PEM || '');
  const publicPem = normalizePem(env.BERLIN_ACCESS_PUBLIC_KEY_PEM || '');
  if (!privatePem || !publicPem) {
    throw new Error('[berlin] Missing BERLIN_ACCESS_PRIVATE_KEY_PEM or BERLIN_ACCESS_PUBLIC_KEY_PEM');
  }

  const privateKey = await importRsaPrivateKeyFromPem(privatePem);
  const publicKey = await importRsaPublicKeyFromPem(publicPem);
  const currentKid = claimAsString(env.BERLIN_ACCESS_PREVIOUS_KID) || null;
  const current = await exportSigningPublic(publicKey, currentKid);

  let previous: SigningPublic | undefined;
  const prevPublicPem = normalizePem(env.BERLIN_ACCESS_PREVIOUS_PUBLIC_KEY_PEM || '');
  if (prevPublicPem) {
    try {
      const prevPublicKey = await importRsaPublicKeyFromPem(prevPublicPem);
      previous = await exportSigningPublic(prevPublicKey, env.BERLIN_ACCESS_PREVIOUS_KID || null);
    } catch {
      previous = undefined;
    }
  }

  const context: SigningContext = {
    kid: current.kid,
    privateKey,
    current,
    ...(previous ? { previous } : {}),
  };
  scope[SIGNING_CONTEXT_KEY] = context;
  return context;
}

async function resolveRefreshHmacKey(env: Env): Promise<CryptoKey> {
  const scope = globalThis as Record<string, unknown>;
  const cached = scope[REFRESH_KEY_CACHE];
  if (cached instanceof CryptoKey) return cached;
  const secret = claimAsString(env.BERLIN_REFRESH_SECRET);
  if (!secret) {
    throw new Error('[berlin] Missing BERLIN_REFRESH_SECRET');
  }
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
  scope[REFRESH_KEY_CACHE] = key;
  return key;
}

export async function deriveNextRti(env: Env, args: { sid: string; ver: number; rti: string }): Promise<string> {
  const key = await resolveRefreshHmacKey(env);
  // Derive the next RTI deterministically from the currently presented token state.
  // This keeps the refresh grace window convergent under concurrent refresh attempts:
  // two valid refreshes racing on the same prior RTI compute the same next RTI instead
  // of minting divergent session state that immediately invalidates one caller.
  const payload = `${args.sid}.${args.ver}.${args.rti}`;
  const digest = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return toBase64Url(new Uint8Array(digest));
}

export async function signAccessToken(claims: AccessClaims, env: Env): Promise<string> {
  const context = await resolveSigningContext(env);
  const header: JwtHeader = {
    alg: 'RS256',
    typ: 'JWT',
    kid: context.kid,
  };
  const headerB64 = encodeJsonBase64Url(header);
  const payloadB64 = encodeJsonBase64Url(claims);
  const data = `${headerB64}.${payloadB64}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', context.privateKey, enc.encode(data));
  return `${data}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAccessToken(token: string, env: Env): Promise<{ ok: true; claims: AccessClaims } | { ok: false; reason: string }> {
  const [headerB64, payloadB64, sigB64] = token.split('.');
  if (!headerB64 || !payloadB64 || !sigB64) return { ok: false, reason: 'malformed' };
  const header = decodeJsonBase64Url<JwtHeader>(headerB64);
  const claims = decodeJsonBase64Url<AccessClaims>(payloadB64);
  const signature = fromBase64Url(sigB64);
  if (!header || !claims || !signature) return { ok: false, reason: 'malformed' };
  if (header.alg !== 'RS256') return { ok: false, reason: 'alg' };
  const context = await resolveSigningContext(env);

  const candidates: SigningPublic[] = [];
  if (!header.kid || header.kid === context.current.kid) candidates.push(context.current);
  if (context.previous && (!header.kid || header.kid === context.previous.kid)) candidates.push(context.previous);
  if (header.kid && !candidates.length) return { ok: false, reason: 'kid' };

  const data = enc.encode(`${headerB64}.${payloadB64}`);
  let verified = false;
  for (const candidate of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', candidate.publicKey, toArrayBuffer(signature), data);
    if (ok) {
      verified = true;
      break;
    }
  }
  if (!verified) return { ok: false, reason: 'signature' };

  const now = Math.floor(Date.now() / 1000);
  const exp = claimAsNumber(claims.exp);
  const nbf = claimAsNumber(claims.nbf);
  const iss = claimAsString(claims.iss);
  if (!exp || exp <= now - ACCESS_TOKEN_SKEW_SECONDS) return { ok: false, reason: 'expired' };
  if (nbf && nbf > now + ACCESS_TOKEN_SKEW_SECONDS) return { ok: false, reason: 'nbf' };
  if (iss !== (claimAsString(env.BERLIN_ISSUER) || DEFAULT_ISSUER)) return { ok: false, reason: 'iss' };
  if (!audienceMatches(claims.aud, claimAsString(env.BERLIN_AUDIENCE) || DEFAULT_AUDIENCE)) {
    return { ok: false, reason: 'aud' };
  }

  return { ok: true, claims };
}

export async function signRefreshToken(payload: RefreshPayloadV2, env: Env): Promise<string> {
  const key = await resolveRefreshHmacKey(env);
  const body = encodeJsonBase64Url(payload);
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return `${REFRESH_TOKEN_PREFIX}.${body}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyRefreshToken(token: string, env: Env, options: { allowExpired?: boolean } = {}): Promise<RefreshResult> {
  const [prefix, body, sigB64] = token.split('.');
  if (prefix !== REFRESH_TOKEN_PREFIX || !body || !sigB64) return { ok: false, reason: 'malformed' };
  const key = await resolveRefreshHmacKey(env);
  const signature = fromBase64Url(sigB64);
  if (!signature) return { ok: false, reason: 'malformed' };
  const ok = await crypto.subtle.verify('HMAC', key, toArrayBuffer(signature), enc.encode(body));
  if (!ok) return { ok: false, reason: 'signature' };

  const parsed = decodeJsonBase64Url<RefreshPayload>(body);
  if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'payload' };
  const version = claimAsNumber(parsed.v);
  if (version !== 2) return { ok: false, reason: 'version' };
  const payload = parsed as RefreshPayload;
  if (!claimAsString(payload.sid) || !claimAsString(payload.rti) || !claimAsNumber(payload.ver) || !claimAsString(payload.userId)) {
    return { ok: false, reason: 'payload' };
  }
  const exp = claimAsNumber(payload.exp);
  if (!exp) return { ok: false, reason: 'payload' };
  if (!options.allowExpired && exp <= Math.floor(Date.now() / 1000)) return { ok: false, reason: 'expired' };
  return { ok: true, payload };
}

export function isRefreshGraceWindow(rtiRotatedAt: number, nowMs: number): boolean {
  return nowMs - rtiRotatedAt <= REFRESH_RTI_GRACE_MS;
}
