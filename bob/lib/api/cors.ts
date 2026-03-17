import type { NextRequest } from 'next/server';

const DEFAULT_ALLOWED_HEADERS = 'authorization, content-type, x-request-id';
const HOST_ALLOWED_ORIGINS = [
  /^http:\/\/localhost:5173$/i,
  /^http:\/\/127\.0\.0\.1:5173$/i,
  /^https:\/\/devstudio\.dev\.clickeen\.com$/i,
  /^http:\/\/localhost:4321$/i,
  /^http:\/\/127\.0\.0\.1:4321$/i,
  /^https:\/\/prague\.dev\.clickeen\.com$/i,
  /^https:\/\/clickeen\.com$/i,
  /^https:\/\/www\.clickeen\.com$/i,
];

function resolveAllowedOrigin(request: NextRequest): string | null {
  const origin = String(request.headers.get('origin') || '').trim();
  if (!origin) return null;
  for (const pattern of HOST_ALLOWED_ORIGINS) {
    if (pattern.test(origin)) return origin;
  }
  return null;
}

export function resolveCorsHeaders(
  request: NextRequest,
  methods: string,
  allowedHeaders = DEFAULT_ALLOWED_HEADERS,
): Record<string, string> {
  const allowedOrigin = resolveAllowedOrigin(request);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': allowedHeaders,
    Vary: 'Origin',
  };

  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}
