import type { Env } from './types';

export type TokyoRequestContext = {
  service: 'tokyo-worker';
  stage: string;
  requestId: string;
  method: string;
  path: string;
  visibility: 'public' | 'internal';
  clientIp: string | null;
  cfRay: string | null;
  startedAt: number;
};

function resolveStage(request: Request, env: Env): string {
  const fromEnv = typeof env.ENV_STAGE === 'string' ? env.ENV_STAGE.trim() : '';
  if (fromEnv) return fromEnv;

  const hostname = new URL(request.url).hostname.trim().toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'local';
  if (hostname.includes('.dev.') || hostname.endsWith('.workers.dev')) return 'cloud-dev';
  return 'unknown';
}

function resolveClientIp(request: Request): string | null {
  const cfConnectingIp = String(request.headers.get('cf-connecting-ip') || '').trim();
  if (cfConnectingIp) return cfConnectingIp;
  const forwardedFor = String(request.headers.get('x-forwarded-for') || '').trim();
  if (!forwardedFor) return null;
  const [first] = forwardedFor.split(',');
  const candidate = String(first || '').trim();
  return candidate || null;
}

function resolveCfRay(request: Request): string | null {
  const raw = String(request.headers.get('cf-ray') || '').trim();
  return raw || null;
}

function isPublicPath(path: string): boolean {
  return !path.startsWith('/__internal/');
}

function cloneResponseWithHeaders(response: Response, headers: Headers): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function applyPublicCors(headers: Headers): void {
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  headers.set(
    'access-control-allow-headers',
    'authorization, content-type, x-account-id, x-filename, x-source, idempotency-key, x-tokyo-l10n-bridge, x-ck-internal-service',
  );
}

function log(level: 'info' | 'warn' | 'error', payload: Record<string, unknown>): void {
  const serialized = JSON.stringify(payload);
  if (level === 'error') {
    console.error(serialized);
    return;
  }
  if (level === 'warn') {
    console.warn(serialized);
    return;
  }
  console.info(serialized);
}

export function createTokyoRequestContext(
  request: Request,
  env: Env,
  path: string,
): TokyoRequestContext {
  const fromHeader = String(request.headers.get('x-request-id') || '').trim();
  return {
    service: 'tokyo-worker',
    stage: resolveStage(request, env),
    requestId: fromHeader || crypto.randomUUID(),
    method: request.method.toUpperCase(),
    path,
    visibility: isPublicPath(path) ? 'public' : 'internal',
    clientIp: resolveClientIp(request),
    cfRay: resolveCfRay(request),
    startedAt: Date.now(),
  };
}

export function finalizeTokyoObservedResponse(args: {
  context: TokyoRequestContext;
  response: Response;
  errorDetail?: string | null;
}): Response {
  const headers = new Headers(args.response.headers);
  headers.set('x-request-id', args.context.requestId);
  if (args.context.visibility === 'public') {
    applyPublicCors(headers);
  }

  const response = cloneResponseWithHeaders(args.response, headers);
  const durationMs = Date.now() - args.context.startedAt;
  const status = response.status;
  const event = status >= 500 ? 'request.failed' : 'request.completed';
  const level: 'info' | 'warn' | 'error' = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

  log(level, {
    event,
    service: args.context.service,
    stage: args.context.stage,
    visibility: args.context.visibility,
    requestId: args.context.requestId,
    method: args.context.method,
    path: args.context.path,
    status,
    durationMs,
    clientIp: args.context.clientIp,
    cfRay: args.context.cfRay,
    ...(args.errorDetail ? { errorDetail: args.errorDetail } : {}),
  });

  return response;
}
