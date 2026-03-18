import { NextRequest, NextResponse } from 'next/server';
import { getOptionalCloudflareRequestContext } from './cloudflare-request-context';
import type { RomaUsageKv } from './account-budget-usage';

const RATE_LIMIT_PREFIX = 'roma:ratelimit:v1';
const REQUEST_CONTEXTS = new WeakMap<NextRequest, RomaRequestContext>();

type RomaRequestContext = {
  service: 'roma';
  stage: string;
  requestId: string;
  method: string;
  path: string;
  clientIp: string | null;
  cfRay: string | null;
  startedAt: number;
  accountId?: string;
  rateLimit?: RateLimitDecision | null;
};

type RateLimitPolicy = {
  bucket: string;
  max: number;
  windowSec: number;
};

type RateLimitDecision =
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

type RomaKv = RomaUsageKv & {
  get(key: string, type: 'json'): Promise<unknown | null>;
  put(
    key: string,
    value: string,
    options?: {
      expirationTtl?: number;
    },
  ): Promise<void>;
};

export type RomaRateLimitKv = RomaKv;

function resolveStage(request: NextRequest): string {
  const requestContext = getOptionalCloudflareRequestContext<{ env?: Record<string, unknown> }>();
  const envStage =
    requestContext?.env && typeof requestContext.env.ENV_STAGE === 'string'
      ? requestContext.env.ENV_STAGE.trim()
      : '';
  if (envStage) return envStage;
  const hostname = request.nextUrl.hostname.trim().toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'local';
  if (hostname.includes('.dev.')) return 'cloud-dev';
  return 'unknown';
}

function resolveClientIp(request: NextRequest): string | null {
  const cfConnectingIp = String(request.headers.get('cf-connecting-ip') || '').trim();
  if (cfConnectingIp) return cfConnectingIp;
  const forwardedFor = String(request.headers.get('x-forwarded-for') || '').trim();
  if (!forwardedFor) return null;
  const [first] = forwardedFor.split(',');
  const candidate = String(first || '').trim();
  return candidate || null;
}

function resolveCfRay(request: NextRequest): string | null {
  const raw = String(request.headers.get('cf-ray') || '').trim();
  return raw || null;
}

function getOrCreateRequestContext(request: NextRequest): RomaRequestContext {
  const existing = REQUEST_CONTEXTS.get(request);
  if (existing) return existing;

  const fromHeader = String(request.headers.get('x-request-id') || '').trim();
  const created: RomaRequestContext = {
    service: 'roma',
    stage: resolveStage(request),
    requestId: fromHeader || crypto.randomUUID(),
    method: request.method.toUpperCase(),
    path: request.nextUrl.pathname.replace(/\/+$/, '') || '/',
    clientIp: resolveClientIp(request),
    cfRay: resolveCfRay(request),
    startedAt: Date.now(),
    rateLimit: null,
  };
  REQUEST_CONTEXTS.set(request, created);
  return created;
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

function resolveRateLimitPolicy(method: string, path: string): RateLimitPolicy | null {
  if (method === 'POST' && path === '/api/account/assets/upload') {
    return { bucket: 'account.assets.upload', max: 60, windowSec: 60 };
  }
  if (method === 'DELETE' && /^\/api\/account\/assets\/[^/]+$/.test(path)) {
    return { bucket: 'account.assets.delete', max: 60, windowSec: 60 };
  }
  if (path === '/api/account/assets/resolve') return null;
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return null;
  if (!path.startsWith('/api/account/')) return null;
  if (path.includes('/copilot')) return null;
  return { bucket: 'account.mutation', max: 120, windowSec: 60 };
}

function rateLimitKey(policy: RateLimitPolicy, accountId: string): string {
  return `${RATE_LIMIT_PREFIX}:${policy.bucket}:acct:${accountId}`;
}

async function consumeRateLimit(
  kv: RomaKv,
  key: string,
  policy: RateLimitPolicy,
  now: number,
): Promise<RateLimitDecision> {
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

export async function enforceRomaRateLimitForAccountRequest(
  request: NextRequest,
  accountId: string,
  usageKv?: RomaKv | null,
): Promise<NextResponse | null> {
  const requestContext = getOrCreateRequestContext(request);
  requestContext.accountId = accountId;

  const policy = resolveRateLimitPolicy(requestContext.method, requestContext.path);
  if (!policy) return null;

  const kv = usageKv ?? null;
  if (!kv) return null;

  const decision = await consumeRateLimit(kv, rateLimitKey(policy, accountId), policy, Date.now());
  requestContext.rateLimit = decision;
  if (decision.allowed) return null;

  return NextResponse.json(
    {
      error: {
        kind: 'RATE_LIMIT',
        reasonKey: 'coreui.errors.rateLimit.exceeded',
        detail: policy.bucket,
      },
    },
    { status: 429 },
  );
}

function applyRateLimitHeaders(response: NextResponse, decision: RateLimitDecision | null | undefined): void {
  if (!decision) return;
  response.headers.set('x-rate-limit-bucket', decision.bucket);
  response.headers.set('x-rate-limit-limit', String(decision.limit));
  response.headers.set('x-rate-limit-remaining', String(decision.remaining));
  response.headers.set('x-rate-limit-reset', new Date(decision.resetAt).toISOString());
  if (!decision.allowed) {
    response.headers.set('retry-after', String(decision.retryAfterSec));
  }
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

export function finalizeRomaObservedResponse(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const requestContext = getOrCreateRequestContext(request);
  response.headers.set('x-request-id', requestContext.requestId);
  applyRateLimitHeaders(response, requestContext.rateLimit);

  const status = response.status;
  const event =
    requestContext.rateLimit?.allowed === false
      ? 'request.rate_limited'
      : status >= 500
        ? 'request.failed'
        : 'request.completed';
  const level: 'info' | 'warn' | 'error' =
    requestContext.rateLimit?.allowed === false ? 'warn' : status >= 500 ? 'error' : 'info';

  log(level, {
    event,
    service: requestContext.service,
    stage: requestContext.stage,
    requestId: requestContext.requestId,
    method: requestContext.method,
    path: requestContext.path,
    status,
    durationMs: Date.now() - requestContext.startedAt,
    clientIp: requestContext.clientIp,
    cfRay: requestContext.cfRay,
    ...(requestContext.accountId ? { accountId: requestContext.accountId } : {}),
    ...(requestContext.rateLimit ? { rateLimitBucket: requestContext.rateLimit.bucket } : {}),
  });

  return response;
}
