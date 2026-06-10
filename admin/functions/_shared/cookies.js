export const ACCESS_COOKIE = 'ck-access-token';
export const REFRESH_COOKIE = 'ck-refresh-token';
export const AUTHZ_CAPSULE_COOKIE = 'ck-authz-capsule';

export function parseCookies(request) {
  const header = request.headers.get('cookie') || '';
  const cookies = new Map();
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) cookies.set(name, value);
  }
  return cookies;
}

function isSecureRequest(request) {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get('x-forwarded-proto')?.trim().toLowerCase() || '';
  return forwardedProto === 'https' || url.protocol === 'https:';
}

function sanitizeCookieValue(value) {
  return String(value || '').replace(/[;\r\n]/g, '');
}

export function serializeHostCookie(request, name, value, maxAge) {
  const parts = [
    `${name}=${sanitizeCookieValue(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(1, Math.floor(maxAge))}`,
  ];
  if (isSecureRequest(request)) parts.push('Secure');
  return parts.join('; ');
}

function decodeJwtPayload(token) {
  const segment = String(token || '').split('.')[1];
  if (!segment) return null;
  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function resolveJwtCookieMaxAge(token, fallbackSeconds) {
  const payload = decodeJwtPayload(token);
  const expClaim = payload?.exp;
  const exp =
    typeof expClaim === 'number'
      ? expClaim
      : typeof expClaim === 'string'
        ? Number.parseInt(expClaim, 10)
        : Number.NaN;
  if (!Number.isFinite(exp)) return fallbackSeconds;
  const now = Math.floor(Date.now() / 1000);
  return Math.max(1, Math.floor(exp - now));
}

function positiveInt(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

export function sessionCookieHeaders(request, session) {
  const accessToken = String(session.accessToken || '').trim();
  const refreshToken = String(session.refreshToken || '').trim();
  const accountCapsule = String(session.accountCapsule || '').trim();
  const headers = [];

  if (accessToken) {
    headers.push(
      serializeHostCookie(
        request,
        ACCESS_COOKIE,
        accessToken,
        positiveInt(session.accessTokenMaxAge, 15 * 60),
      ),
    );
  }
  if (refreshToken) {
    headers.push(
      serializeHostCookie(
        request,
        REFRESH_COOKIE,
        refreshToken,
        positiveInt(session.refreshTokenMaxAge, 60 * 60 * 24 * 30),
      ),
    );
  }
  if (accountCapsule) {
    headers.push(
      serializeHostCookie(
        request,
        AUTHZ_CAPSULE_COOKIE,
        accountCapsule,
        resolveJwtCookieMaxAge(accountCapsule, 30 * 60),
      ),
    );
  }

  return headers;
}
