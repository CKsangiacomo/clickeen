export const CACHE_HEADERS = {
  'cache-control': 'no-store',
  'cdn-cache-control': 'no-store',
  'cloudflare-cdn-cache-control': 'no-store',
};

export function json(payload, status = 200) {
  return Response.json(payload, { status, headers: CACHE_HEADERS });
}

export function redirect(location, status = 302) {
  return new Response(null, {
    status,
    headers: {
      ...CACHE_HEADERS,
      location,
    },
  });
}

export function methodNotAllowed() {
  return json(
    { error: { kind: 'METHOD_NOT_ALLOWED', reasonKey: 'coreui.errors.methodNotAllowed' } },
    405,
  );
}

export function resolveRequestProtocol(request) {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get('x-forwarded-proto')?.trim().toLowerCase() || '';
  if (forwardedProto === 'https') return 'https:';
  if (forwardedProto === 'http') return 'http:';
  return url.protocol === 'http:' ? 'http:' : 'https:';
}

export function resolveRequestOrigin(request) {
  const url = new URL(request.url);
  const forwardedHost = request.headers
    .get('x-forwarded-host')
    ?.split(',')[0]
    ?.trim()
    .toLowerCase();
  const host = forwardedHost || request.headers.get('host')?.trim().toLowerCase() || url.host;
  return `${resolveRequestProtocol(request)}//${host}`;
}

export function resolveSafeNextPath(value, fallback = '/') {
  const normalized = String(value || '').trim();
  if (!normalized.startsWith('/')) return fallback;
  if (normalized.startsWith('//')) return fallback;
  if (normalized.length > 2048) return fallback;
  return normalized || fallback;
}

export function cloneResponseWithCookies(response, cookies) {
  if (!cookies?.length) return response;
  const next = new Response(response.body, response);
  for (const cookie of cookies) {
    next.headers.append('set-cookie', cookie);
  }
  return next;
}
