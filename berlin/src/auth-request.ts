import { asBearerToken, claimAsString } from './helpers';
import { REFRESH_TOKEN_PREFIX } from './types';

export function parseCookieValue(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  const entries = header.split(';');
  for (const entry of entries) {
    const [rawName, ...rest] = entry.trim().split('=');
    if (!rawName || rawName !== name) continue;
    const joined = rest.join('=').trim();
    if (!joined) return null;
    try {
      return decodeURIComponent(joined);
    } catch {
      return joined;
    }
  }
  return null;
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  const parsed = (await request.json().catch(() => null)) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

export function resolveRefreshTokenFromRequest(request: Request, body: Record<string, unknown> | null): string | null {
  const fromBody = claimAsString(body?.refreshToken);
  if (fromBody) return fromBody;

  const fromCookie =
    parseCookieValue(request, 'ck-refresh-token') ||
    parseCookieValue(request, 'ck-roma-rt') ||
    parseCookieValue(request, 'ck-bob-rt');
  if (fromCookie) return fromCookie;

  const bearer = asBearerToken(request.headers.get('authorization'));
  if (bearer && bearer.startsWith(`${REFRESH_TOKEN_PREFIX}.`)) return bearer;

  return null;
}

export function resolveAccessTokenFromRequest(request: Request): string | null {
  const fromBearer = asBearerToken(request.headers.get('authorization'));
  if (fromBearer && !fromBearer.startsWith(`${REFRESH_TOKEN_PREFIX}.`)) return fromBearer;

  const fromCookie =
    parseCookieValue(request, 'ck-access-token') ||
    parseCookieValue(request, 'ck-roma-at') ||
    parseCookieValue(request, 'ck-bob-at');
  if (fromCookie) return fromCookie;

  return null;
}
