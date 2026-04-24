import { json } from './helpers';
import { type Env } from './types';

const RATE_LIMIT_PREFIX = 'berlin:ratelimit:v1';

export type BerlinRequestContext = {
  service: 'berlin';
  stage: string;
  requestId: string;
  method: string;
  path: string;
  clientIp: string | null;
  cfRay: string | null;
  startedAt: number;
};

type RateLimitPolicy = {
  bucket: string;
  max: number;
  windowSec: number;
  vary: 'ip';
};

export type RateLimitDecision =
  | {
      allowed: true;
      bucket: string;
      limit: number;
      remaining: number;
      resetAt: number;
    }
  | {
      allowed: false;
      bucket: string;
      limit: number;
      remaining: 0;
      resetAt: number;
      retryAfterSec: number;
    };

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

function normalizeStage(env: Env): string {
  const stage = typeof env.ENV_STAGE === 'string' ? env.ENV_STAGE.trim() : '';
  return stage || 'unknown';
}

function normalizeClientIp(request: Request): string | null {
  const cfConnectingIp = String(request.headers.get('cf-connecting-ip') || '').trim();
  if (cfConnectingIp) return cfConnectingIp;
  const forwardedFor = String(request.headers.get('x-forwarded-for') || '').trim();
  if (!forwardedFor) return null;
  const [first] = forwardedFor.split(',');
  const candidate = String(first || '').trim();
  return candidate || null;
}

function normalizeCfRay(request: Request): string | null {
  const raw = String(request.headers.get('cf-ray') || '').trim();
  return raw || null;
}

export function createBerlinRequestContext(request: Request, env: Env): BerlinRequestContext {
  const fromHeader = String(request.headers.get('x-request-id') || '').trim();
  const pathname = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
  return {
    service: 'berlin',
    stage: normalizeStage(env),
    requestId: fromHeader || crypto.randomUUID(),
    method: request.method.toUpperCase(),
    path: pathname,
    clientIp: normalizeClientIp(request),
    cfRay: normalizeCfRay(request),
    startedAt: Date.now(),
  };
}

function resolveRateLimitPolicy(method: string, path: string): RateLimitPolicy | null {
  if (method === 'POST' && path === '/auth/login/password') {
    return { bucket: 'auth.login.password', max: 8, windowSec: 60, vary: 'ip' };
  }
  if (method === 'POST' && path === '/auth/login/provider/start') {
    return { bucket: 'auth.login.provider.start', max: 12, windowSec: 60, vary: 'ip' };
  }
  if (method === 'GET' && /^\/auth\/login\/[^/]+\/start$/.test(path)) {
    return { bucket: 'auth.login.provider.start', max: 12, windowSec: 60, vary: 'ip' };
  }
  if (method === 'POST' && path === '/auth/finish') {
    return { bucket: 'auth.finish', max: 20, windowSec: 60, vary: 'ip' };
  }
  if (method === 'POST' && path === '/auth/refresh') {
    return { bucket: 'auth.refresh', max: 60, windowSec: 60, vary: 'ip' };
  }
  if (method === 'POST' && path === '/auth/logout') {
    return { bucket: 'auth.logout', max: 60, windowSec: 60, vary: 'ip' };
  }
  return null;
}

function rateLimitKey(policy: RateLimitPolicy, context: BerlinRequestContext): string | null {
  if (policy.vary !== 'ip') return null;
  if (!context.clientIp) return null;
  return `${RATE_LIMIT_PREFIX}:${policy.bucket}:ip:${context.clientIp}`;
}

function parseRateLimitRecord(value: unknown): RateLimitRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const count =
    typeof record.count === 'number' && Number.isFinite(record.count)
      ? Math.max(0, Math.trunc(record.count))
      : null;
  const resetAt =
    typeof record.resetAt === 'number' && Number.isFinite(record.resetAt)
      ? Math.max(0, Math.trunc(record.resetAt))
      : null;
  if (count == null || resetAt == null) return null;
  return { count, resetAt };
}

async function consumeRateLimit(
  env: Env,
  key: string,
  policy: RateLimitPolicy,
  now: number,
): Promise<RateLimitDecision> {
  const kv = env.BERLIN_SESSION_KV;
  if (!kv) {
    return {
      allowed: true,
      bucket: policy.bucket,
      limit: policy.max,
      remaining: policy.max,
      resetAt: now + policy.windowSec * 1000,
    };
  }

  const existingRaw = await kv.get(key, 'json').catch(() => null);
  const existing = parseRateLimitRecord(existingRaw);
  const active =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + policy.windowSec * 1000 };

  if (active.count >= policy.max) {
    return {
      allowed: false,
      bucket: policy.bucket,
      limit: policy.max,
      remaining: 0,
      resetAt: active.resetAt,
      retryAfterSec: Math.max(1, Math.ceil((active.resetAt - now) / 1000)),
    };
  }

  const nextCount = active.count + 1;
  const nextRecord: RateLimitRecord = {
    count: nextCount,
    resetAt: active.resetAt,
  };
  const ttlSeconds = Math.max(1, Math.ceil((nextRecord.resetAt - now) / 1000) + 60);
  await kv.put(key, JSON.stringify(nextRecord), { expirationTtl: ttlSeconds });

  return {
    allowed: true,
    bucket: policy.bucket,
    limit: policy.max,
    remaining: Math.max(0, policy.max - nextCount),
    resetAt: nextRecord.resetAt,
  };
}

function cloneResponseWithHeaders(response: Response, headers: Headers): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function attachBerlinRequestHeaders(
  response: Response,
  context: BerlinRequestContext,
  decision?: RateLimitDecision | null,
): Response {
  const headers = new Headers(response.headers);
  headers.set('x-request-id', context.requestId);
  if (decision) {
    headers.set('x-rate-limit-bucket', decision.bucket);
    headers.set('x-rate-limit-limit', String(decision.limit));
    headers.set('x-rate-limit-remaining', String(decision.remaining));
    headers.set('x-rate-limit-reset', new Date(decision.resetAt).toISOString());
    if (!decision.allowed) {
      headers.set('retry-after', String(decision.retryAfterSec));
    }
  }
  return cloneResponseWithHeaders(response, headers);
}

export async function enforceBerlinRateLimit(
  env: Env,
  context: BerlinRequestContext,
): Promise<{ response: Response; decision: RateLimitDecision } | null> {
  const policy = resolveRateLimitPolicy(context.method, context.path);
  if (!policy) return null;
  const key = rateLimitKey(policy, context);
  if (!key) return null;

  const decision = await consumeRateLimit(env, key, policy, Date.now());
  if (decision.allowed) return null;

  return {
    response: json(
      {
        error: {
          kind: 'RATE_LIMIT',
          reasonKey: 'coreui.errors.rateLimit.exceeded',
          detail: policy.bucket,
        },
      },
      { status: 429 },
    ),
    decision,
  };
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

export function logBerlinRequestCompletion(args: {
  context: BerlinRequestContext;
  response: Response;
  decision?: RateLimitDecision | null;
  errorDetail?: string | null;
}): void {
  const durationMs = Date.now() - args.context.startedAt;
  const status = args.response.status;
  const event =
    args.decision?.allowed === false
      ? 'request.rate_limited'
      : status >= 500
        ? 'request.failed'
        : 'request.completed';
  const level: 'info' | 'warn' | 'error' =
    args.decision?.allowed === false ? 'warn' : status >= 500 ? 'error' : 'info';
  log(level, {
    event,
    service: args.context.service,
    stage: args.context.stage,
    requestId: args.context.requestId,
    method: args.context.method,
    path: args.context.path,
    status,
    durationMs,
    clientIp: args.context.clientIp,
    cfRay: args.context.cfRay,
    ...(args.decision ? { rateLimitBucket: args.decision.bucket } : {}),
    ...(args.errorDetail ? { errorDetail: args.errorDetail } : {}),
  });
}
